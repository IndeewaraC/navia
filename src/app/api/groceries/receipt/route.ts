import { createClient } from '@/src/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateGroceryTotal } from '@/src/lib/groceryPricing';

const GroceryReceiptSchema = z.object({
  store_name: z.string().min(1, { message: "Store name is required" }),
  trip_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  raw_subtotal: z.number().nonnegative(),
  tax_and_fees: z.number().nonnegative().default(0),
  discount_amount: z.number().nonnegative().default(0),
  final_settled_total: z.number().positive().nullable(),
  total_mode: z.enum(['calculated', 'manual', 'unknown']).default('calculated'),
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

    const manualTotal = parsedData.total_mode === 'manual' ? parsedData.final_settled_total : null;
    const pricing = calculateGroceryTotal(parsedData.items, parsedData.tax_and_fees, parsedData.discount_amount, manualTotal);
    const submittedTotal = parsedData.final_settled_total === null ? null : Number(parsedData.final_settled_total.toFixed(2));
    if (pricing.error || pricing.total !== submittedTotal || (parsedData.total_mode === 'manual' && manualTotal === null)) {
      return NextResponse.json(
        { error: pricing.error || 'Final total must match the item prices, taxes and discounts, or be entered manually.' },
        { status: 400 }
      );
    }

    // 2. We no longer auto-insert into `transactions`. 
    // The Grocery module is for reporting and receipt tracking only.

    // 3. Log the Grocery Trip Details
    const { data: trip, error: tripError } = await supabase
      .from('grocery_trips')
      .insert({
        user_id: user.id,
        trip_date: parsedData.trip_date,
        store_name: parsedData.store_name,
        raw_subtotal: pricing.subtotal,
        tax_and_fees: parsedData.tax_and_fees,
        discount_amount: parsedData.discount_amount,
        final_settled_total: submittedTotal,
        receipt_items: parsedData.items
      })
      .select('trip_id')
      .single();

    if (tripError) throw new Error('Failed to record receipt metadata.');

    return NextResponse.json(
      { message: 'Grocery prices saved successfully.', trip_id: trip.trip_id },
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
