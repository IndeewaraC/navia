import { createClient } from '@/src/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

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
        .single();

      if (account && account.routine_monthly_limit > 0) {
        // Calculate the current operational spend for the active 14-day cycle
        // Note: In production, cycle start/end dates would be dynamically calculated based on the user's anchor_pay_date. 
        // For Sprint 1, we aggregate all non-exempt expenses for the current month.
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        
        const { data: currentSpend } = await supabase
          .from('transactions')
          .select('amount')
          .eq('source_account_id', parsedData.source_account_id)
          .eq('txn_type', 'EXPENSE')
          .eq('is_budget_cap_exempt', false)
          .gte('transaction_date', startOfMonth);

        const totalOperationalSpend = (currentSpend?.reduce((sum, txn) => sum + Number(txn.amount), 0) || 0) + parsedData.amount;
        const spendPercentage = (totalOperationalSpend / account.routine_monthly_limit) * 100;

        // Generate Navia threshold warnings
        if (spendPercentage >= 100) {
          thresholdAlert = { level: 'BREACH', message: '100% Operational Limit Exceeded', current_spend: totalOperationalSpend };
        } else if (spendPercentage >= 80) {
          thresholdAlert = { level: 'WARNING', message: '80% Operational Limit Reached', current_spend: totalOperationalSpend };
        }
      }
    }

    // 4. Commit the transaction to the Navia Vault
    // RLS automatically enforces that user_id matches auth.uid() at the database layer
    const { data: transaction, error: insertError } = await supabase
      .from('transactions')
      .insert({
        ...parsedData,
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
