import { createHmac, timingSafeEqual } from 'node:crypto';

export const RECEIPT_UNDO_MS = 30_000;

export type ReceiptSnapshot = {
  trip_id: string;
  user_id: string;
  transaction_id: string | null;
  trip_date: string;
  store_name: string;
  raw_subtotal: number | null;
  tax_and_fees: number | null;
  discount_amount: number | null;
  final_settled_total: number | null;
  receipt_items: unknown;
  created_at: string;
};

export class ReceiptUndoError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function signature(payload: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new ReceiptUndoError('Receipt recovery is unavailable. Please try again later.', 503);
  return createHmac('sha256', secret).update(`navia:receipt-undo:v1:${payload}`).digest();
}

// The signed snapshot lets Undo restore the original row without accepting
// replacement receipt data from the browser or introducing a database migration.
export function createReceiptUndoToken(receipt: ReceiptSnapshot, now = Date.now()) {
  const expiresAt = now + RECEIPT_UNDO_MS;
  const payload = Buffer.from(JSON.stringify({ receipt, expiresAt })).toString('base64url');
  const token = `${payload}.${signature(payload).toString('base64url')}`;
  if (token.length > 2_000_000) throw new ReceiptUndoError('This receipt is too large to delete with Undo.', 422);
  return { token, expiresAt };
}

export function readReceiptUndoToken(token: string, userId: string, tripId: string, now = Date.now()): ReceiptSnapshot {
  const invalid = () => new ReceiptUndoError('This receipt cannot be restored with that Undo link.', 400);
  if (token.length > 2_000_000) throw invalid();
  const parts = token.split('.');
  if (parts.length !== 2) throw invalid();
  const [payload, signed] = parts;
  const expected = signature(payload);
  const supplied = Buffer.from(signed, 'base64url');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw invalid();

  let decoded;
  try { decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); }
  catch { throw invalid(); }
  if (!decoded || !Number.isFinite(decoded.expiresAt) || !decoded.receipt
    || decoded.receipt.user_id !== userId || decoded.receipt.trip_id !== tripId) throw invalid();
  if (now >= decoded.expiresAt) throw new ReceiptUndoError('The Undo window has expired.', 410);
  return decoded.receipt;
}
