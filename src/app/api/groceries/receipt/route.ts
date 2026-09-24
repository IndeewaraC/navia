import { createClient } from '@/src/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const GroceryReceiptSchema = z.object({
  source_account_id: z.string().uuid(),
  store_name: z.string().min(1, { message: "Store name is required" }),
  trip_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  raw_subtotal: z.number().nonnegative(),
  tax_and_fees: z.number().nonnegative().default(0),
  discount_amount: z.number().nonnegative().default(0),
  final_settled_total: z.number().positive(),
  items: z.array(z.object({
    id: z.string(),
    name: z.string(),
    shelfPrice: z.number().nonnegative(),
    isChecked: z.boolean()
  }))
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
    }

    const body = await request.json();
    const parsedData = GroceryReceiptSchema.parse(body);

    // 1. Atomic Receipt Math Validation (BR-04)
    const expectedTotal = Number((parsedData.raw_subtotal + parsedData.tax_and_fees - parsedData.discount_amount).toFixed(2));
    const submittedTotal = Number(parsedData.final_settled_total.toFixed(2));

    if (expectedTotal !== submittedTotal) {
      return NextResponse.json(
        { error: `Math mismatch: Subtotal + Taxes - Discounts equals $${expectedTotal}, but $${submittedTotal} was submitted.` },
        { status: 400 }
      );
    }

    // 2. Log the Master Transaction (Operational Spend)
    const { data: transaction, error: txnError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        source_account_id: parsedData.source_account_id,
        txn_type: 'EXPENSE',
        amount: submittedTotal,
        transaction_date: parsedData.trip_date,
        category: `Grocery Run - ${parsedData.store_name}`,
        is_budget_cap_exempt: false, // Groceries are strictly operational survival costs
      })
      .select('transaction_id')
      .single();

    if (txnError) throw new Error('Failed to route grocery cost to ledger.');

    // 3. Log the Grocery Trip Details
    const { data: trip, error: tripError } = await supabase
      .from('grocery_trips')
      .insert({
        user_id: user.id,
        transaction_id: transaction.transaction_id,
        trip_date: parsedData.trip_date,
        store_name: parsedData.store_name,
        raw_subtotal: parsedData.raw_subtotal,
        tax_and_fees: parsedData.tax_and_fees,
        discount_amount: parsedData.discount_amount,
        final_settled_total: submittedTotal,
        receipt_items: parsedData.items
      })
      .select('trip_id')
      .single();

    if (tripError) throw new Error('Failed to record receipt metadata.');

    return NextResponse.json(
      { message: 'Grocery trip settled and routed to ledger successfully.', trip_id: trip.trip_id },
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
