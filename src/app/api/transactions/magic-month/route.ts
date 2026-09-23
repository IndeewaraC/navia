import { createClient } from '@/src/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const MagicMonthRoutingSchema = z.object({
  source_account_id: z.string().uuid({ message: "Invalid source account" }),
  destination_account_id: z.string().uuid({ message: "Invalid destination account" }),
  amount: z.number().positive({ message: "Amount must be greater than zero" }),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // 1. Authenticate the session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
    }

    const body = await request.json();
    const parsedData = MagicMonthRoutingSchema.parse(body);

    // 2. Execute the Magic Month Transfer
    // We log this as a 'TRANSFER' so it inherently bypasses the 80%/100% operational expense logic
    const { data: transaction, error: insertError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        source_account_id: parsedData.source_account_id,
        txn_type: 'TRANSFER',
        amount: parsedData.amount,
        transaction_date: new Date().toISOString().split('T')[0],
        category: '✨ Magic Month Surplus Routing',
        is_budget_cap_exempt: true, 
      })
      .select('transaction_id, amount')
      .single();

    if (insertError) {
      console.error('Magic Month Routing Error:', insertError.message);
      return NextResponse.json({ error: 'Failed to route emergency funds' }, { status: 500 });
    }

    return NextResponse.json(
      { 
        message: 'Surplus successfully routed to your emergency safety net.', 
        transaction 
      }, 
      { status: 201 }
    );

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues.map(e => e.message).join(', ') }, { status: 400 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
