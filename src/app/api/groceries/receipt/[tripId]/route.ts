import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/src/lib/supabase/server';
import { createAdminClient } from '@/src/lib/supabase/admin';
import { createReceiptUndoToken, readReceiptUndoToken, ReceiptUndoError } from '@/src/lib/receiptUndo';

type Context = { params: Promise<{ tripId: string }> };
const totalSchema = z.number().positive().refine(value => Number(value.toFixed(2)) === value, 'Use at most two decimal places.');
const editSchema = z.object({ final_settled_total: totalSchema, expected_total: totalSchema.nullable() }).strict();
const deleteSchema = z.object({ expected_total: totalSchema.nullable() }).strict();
const restoreSchema = z.object({ undo_token: z.string().min(1).max(2_000_000) }).strict();
const receiptColumns = 'trip_id, user_id, transaction_id, trip_date, store_name, raw_subtotal, tax_and_fees, discount_amount, final_settled_total, receipt_items, created_at';

async function receiptContext(context: Context) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new ReceiptUndoError('Sign in to manage your receipts.', 401);
  const { tripId } = await context.params;
  if (!z.string().uuid().safeParse(tripId).success) throw new ReceiptUndoError('Invalid receipt ID.', 400);
  return { userId: user.id, tripId, store: createAdminClient() };
}

function failed(error: unknown) {
  if (error instanceof ReceiptUndoError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError || error instanceof SyntaxError) {
    return NextResponse.json({ error: 'Enter a positive final total with at most two decimal places, or a valid receipt action.' }, { status: 400 });
  }
  return NextResponse.json({ error: 'Unable to update this receipt. Please try again.' }, { status: 500 });
}

async function ownedReceipt({ store, userId, tripId }: Awaited<ReturnType<typeof receiptContext>>) {
  const { data, error } = await store.from('grocery_trips').select(receiptColumns)
    .eq('user_id', userId).eq('trip_id', tripId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const auth = await receiptContext(context);
    const body = editSchema.parse(await request.json());
    const receipt = await ownedReceipt(auth);
    if (!receipt) throw new ReceiptUndoError('Receipt not found.', 404);

    let query = auth.store.from('grocery_trips').update({ final_settled_total: body.final_settled_total })
      .eq('user_id', auth.userId).eq('trip_id', auth.tripId);
    query = body.expected_total === null ? query.is('final_settled_total', null) : query.eq('final_settled_total', body.expected_total);
    const { data, error } = await query.select(receiptColumns).maybeSingle();
    if (error) throw error;
    if (!data) throw new ReceiptUndoError('This receipt changed. Refresh the page and try again.', 409);
    revalidatePath('/groceries');
    return NextResponse.json({ trip: data });
  } catch (error) { return failed(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const auth = await receiptContext(context);
    const body = deleteSchema.parse(await request.json());
    const receipt = await ownedReceipt(auth);
    if (!receipt) throw new ReceiptUndoError('Receipt not found.', 404);
    if (receipt.final_settled_total !== body.expected_total) throw new ReceiptUndoError('This receipt changed. Refresh the page and try again.', 409);
    // Prepare recovery before deleting, so a configuration failure cannot leave
    // the user with a deleted receipt and no Undo token.
    const undo = createReceiptUndoToken(receipt);
    let query = auth.store.from('grocery_trips').delete().eq('user_id', auth.userId).eq('trip_id', auth.tripId);
    query = body.expected_total === null ? query.is('final_settled_total', null) : query.eq('final_settled_total', body.expected_total);
    const { data, error } = await query.select('trip_id').maybeSingle();
    if (error) throw error;
    if (!data) throw new ReceiptUndoError('This receipt changed. Refresh the page and try again.', 409);
    revalidatePath('/groceries');
    return NextResponse.json({ undo_token: undo.token, undo_expires_at: undo.expiresAt });
  } catch (error) { return failed(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    const auth = await receiptContext(context);
    const body = restoreSchema.parse(await request.json());
    const snapshot = readReceiptUndoToken(body.undo_token, auth.userId, auth.tripId);
    // A repeated Undo after a lost response must not overwrite a restored total.
    const existing = await ownedReceipt(auth);
    if (existing) return NextResponse.json({ trip: existing });
    const { data, error } = await auth.store.from('grocery_trips').insert(snapshot).select(receiptColumns).single();
    if (error) {
      if (error.code === '23505') {
        const restored = await ownedReceipt(auth);
        if (restored) return NextResponse.json({ trip: restored });
        throw new ReceiptUndoError('This receipt could not be restored. Refresh the page and try again.', 409);
      }
      throw error;
    }
    revalidatePath('/groceries');
    return NextResponse.json({ trip: data });
  } catch (error) { return failed(error); }
}
