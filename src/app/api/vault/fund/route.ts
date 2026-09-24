import { createClient } from '@/src/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const FundSchema = z.object({
  project_id: z.string().uuid(),
  source_account_id: z.string().uuid(),
  amount: z.number().positive(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
    }

    const body = await request.json();
    const parsedData = FundSchema.parse(body);

    // 1. Verify source account has enough funds (optional but good practice)
    const { data: account, error: accError } = await supabase
      .from('payment_accounts')
      .select('current_statement_balance')
      .eq('account_id', parsedData.source_account_id)
      .eq('user_id', user.id)
      .single();

    if (accError || !account) throw new Error('Source account not found.');
    if (account.current_statement_balance < parsedData.amount) {
      throw new Error('Insufficient funds in the source account.');
    }

    // 2. Log the funding transaction (exempt from operational budget caps)
    const { data: transaction, error: txnError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        source_account_id: parsedData.source_account_id,
        exempt_project_id: parsedData.project_id,
        txn_type: 'TRANSFER',
        amount: parsedData.amount,
        transaction_date: new Date().toISOString().split('T')[0],
        category: 'Exempt Project Funding',
        is_budget_cap_exempt: true, // Core BRD requirement!
      })
      .select('transaction_id')
      .single();

    if (txnError) throw new Error('Failed to record funding transaction.');

    // 3. Update the project's saved amount
    // Ideally this is done via a PostgreSQL function (RPC) or trigger to avoid race conditions,
    // but we can do a simple read/update here for the MVP.
    const { data: project } = await supabase
      .from('exempt_projects')
      .select('saved_amount')
      .eq('project_id', parsedData.project_id)
      .single();

    const newSaved = Number((project?.saved_amount || 0)) + parsedData.amount;

    const { error: updateError } = await supabase
      .from('exempt_projects')
      .update({ saved_amount: newSaved })
      .eq('project_id', parsedData.project_id);

    if (updateError) throw new Error('Failed to update project balance.');

    // 4. Update the checking account balance (deduct the funds)
    const newBalance = account.current_statement_balance - parsedData.amount;
    await supabase
      .from('payment_accounts')
      .update({ current_statement_balance: newBalance })
      .eq('account_id', parsedData.source_account_id);

    return NextResponse.json({ message: 'Project funded successfully' }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues.map(e => e.message).join(', ') }, { status: 400 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
