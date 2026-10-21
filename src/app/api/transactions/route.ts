import { createClient } from '@/src/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPayCycleStatus } from '@/src/lib/payCycleDates';

// Zero-Trust Payload Validation
const TransactionSchema = z.object({
  source_account_id: z.string().uuid({ message: "Invalid account ID" }),
  project_id: z.string().uuid().optional().nullable(),
  txn_type: z.enum(['EXPENSE', 'TRANSFER', 'INCOME']),
  amount: z.number().positive({ message: "Amount must be greater than zero" }),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Format must be YYYY-MM-DD" }),
  category: z.string().min(1, { message: "Category is required" }),
  is_budget_cap_exempt: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // 1. Authenticate the session (Tenant Identification)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
    }

    // 2. Validate incoming payload against the schema
    const body = await request.json();
    const parsedData = TransactionSchema.parse(body);

    // 3. Dual-Layer Limit Engine: Pre-flight checks for operational expenses
    let thresholdAlert = null;
    
    if (parsedData.txn_type === 'EXPENSE' && !parsedData.is_budget_cap_exempt) {
      // Retrieve the routine monthly limit for the source account
      const { data: account } = await supabase
        .from('payment_accounts')
        .select('routine_monthly_limit')
        .eq('account_id', parsedData.source_account_id)
        .eq('user_id', user.id)
        .single();

      if (account && account.routine_monthly_limit > 0) {
        // Match the dashboard's configured 14-day payday cycle.
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('anchor_pay_date')
          .eq('id', user.id)
          .maybeSingle();
        if (profileError) {
          return NextResponse.json({ error: 'Unable to load the configured pay cycle.' }, { status: 500 });
        }
        const cycle = getPayCycleStatus(profile?.anchor_pay_date);
        const { data: currentSpend, error: spendError } = await supabase
          .from('transactions')
          .select('amount')
          .eq('user_id', user.id)
          .eq('source_account_id', parsedData.source_account_id)
          .eq('txn_type', 'EXPENSE')
          .eq('is_budget_cap_exempt', false)
          .gte('transaction_date', cycle.cycle_start)
          .lte('transaction_date', cycle.cycle_end);
        if (spendError) return NextResponse.json({ error: 'Unable to calculate current spending.' }, { status: 500 });

        const isInActiveCycle = parsedData.transaction_date >= cycle.cycle_start && parsedData.transaction_date <= cycle.cycle_end;
        const totalOperationalSpend = (currentSpend?.reduce((sum, txn) => sum + Number(txn.amount), 0) || 0) + (isInActiveCycle ? parsedData.amount : 0);
        const spendPercentage = (totalOperationalSpend / account.routine_monthly_limit) * 100;

        // Generate Navia threshold warnings
        if (isInActiveCycle && spendPercentage >= 100) {
          thresholdAlert = { level: 'BREACH', message: '100% Operational Limit Exceeded', current_spend: totalOperationalSpend };
        } else if (isInActiveCycle && spendPercentage >= 80) {
          thresholdAlert = { level: 'WARNING', message: '80% Operational Limit Reached', current_spend: totalOperationalSpend };
        }
      }
    }

    // 4. Commit the transaction to the Navia Vault
    // RLS automatically enforces that user_id matches auth.uid() at the database layer
    const { data: transaction, error: insertError } = await supabase
      .from('transactions')
      .insert({
        source_account_id: parsedData.source_account_id,
        txn_type: parsedData.txn_type,
        amount: parsedData.amount,
        transaction_date: parsedData.transaction_date,
        category: parsedData.category,
        is_budget_cap_exempt: parsedData.is_budget_cap_exempt,
        exempt_project_id: parsedData.project_id || null, // Map the generic project_id to the specific column
        user_id: user.id, 
      })
      .select()
      .single();

    if (insertError) {
      console.error('Transaction Insertion Error:', insertError.message);
      return NextResponse.json({ error: 'Failed to record transaction' }, { status: 500 });
    }

    // 5. Return success payload including any Dual-Layer threshold alerts
    return NextResponse.json(
      { 
        message: 'Transaction securely logged.', 
        transaction,
        threshold_alert: thresholdAlert 
      }, 
      { status: 201 }
    );

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues.map(e => e.message).join(', ') }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
