'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { formatCalendarDate } from '@/src/lib/calendarDateDisplay';

type Trip = {
  trip_id: string;
  store_name: string;
  trip_date: string;
  final_settled_total: number | null;
  receipt_items?: { id: string; name: string; shelfPrice: number }[] | null;
};
type Mode = 'view' | 'edit' | 'confirm';
type Undo = { token: string; expiresAt: number };
type ReceiptResponse = { trip?: Trip; undo_token?: string; undo_expires_at?: number };

async function receiptRequest(tripId: string, method: string, body: object): Promise<ReceiptResponse> {
  let response: Response;
  try {
    response = await fetch(`/api/groceries/receipt/${encodeURIComponent(tripId)}`, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach Navia. Please check your connection and try again.');
  }
  const data = await response.json().catch(() => { throw new Error('Unable to update this receipt. Please try again.'); });
  if (!response.ok) throw new Error(data.error || 'Unable to update this receipt. Please try again.');
  return data;
}

export default function PastReceiptCard({ trip }: { trip: Trip }) {
  const router = useRouter();
  const [savedReceipt, setSavedReceipt] = useState<Trip | null>(null);
  const receipt = savedReceipt || trip;
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('view');
  const [totalInput, setTotalInput] = useState('');
  const [expectedTotal, setExpectedTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [undo, setUndo] = useState<Undo | null>(null);
  const [undoExpired, setUndoExpired] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const undoButtonRef = useRef<HTMLButtonElement>(null);
  const totalText = receipt.final_settled_total === null ? 'Total not entered' : `$${Number(receipt.final_settled_total).toFixed(2)}`;
  const editLabel = receipt.final_settled_total === null ? 'Add total' : 'Edit total';

  const close = useCallback(() => {
    if (busyRef.current) return;
    setIsOpen(false);
    setError('');
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = openerRef.current || document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = dialogRef.current!;
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'));
    (panel.querySelector<HTMLElement>('[data-initial-focus]') || focusable()[0] || panel).focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (!elements.length) { event.preventDefault(); panel.focus(); return; }
      const first = elements[0], last = elements[elements.length - 1];
      if (!panel.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
      openerRef.current = null;
    };
  }, [isOpen, close]);

  useEffect(() => {
    if (!undo) return;
    undoButtonRef.current?.focus();
    const timer = setTimeout(() => {
      setUndoExpired(true);
      router.refresh();
    }, Math.max(0, undo.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [undo, router]);

  function open(nextMode: Mode, trigger?: HTMLButtonElement) {
    if (trigger) openerRef.current = trigger;
    setMode(nextMode);
    setTotalInput(receipt.final_settled_total === null ? '' : String(receipt.final_settled_total));
    setExpectedTotal(receipt.final_settled_total);
    setError('');
    setIsOpen(true);
  }

  function working(value: boolean) { busyRef.current = value; setBusy(value); }

  async function saveTotal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    const amount = Number(totalInput);
    if (!totalInput.trim() || !Number.isFinite(amount) || amount <= 0 || Number(amount.toFixed(2)) !== amount) {
      setError('Enter a positive total with at most two decimal places.');
      return;
    }
    working(true);
    setError('');
    try {
      const data = await receiptRequest(receipt.trip_id, 'PATCH', { final_settled_total: amount, expected_total: expectedTotal });
      if (!data.trip) throw new Error('Unable to confirm the saved receipt. Please refresh the page.');
      setSavedReceipt(data.trip);
      setNotice('Receipt total saved.');
      setIsOpen(false);
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save the total. Please try again.'); }
    finally { working(false); }
  }

  async function deleteReceipt() {
    if (busyRef.current) return;
    working(true);
    setError('');
    try {
      const data = await receiptRequest(receipt.trip_id, 'DELETE', { expected_total: expectedTotal });
      if (!data.undo_token || !data.undo_expires_at) throw new Error('Unable to confirm the deletion. Please refresh the page.');
      setUndo({ token: data.undo_token, expiresAt: data.undo_expires_at });
      setUndoExpired(false);
      setIsOpen(false);
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to delete the receipt. Please try again.'); }
    finally { working(false); }
  }

  async function restoreReceipt() {
    if (!undo || busyRef.current) return;
    working(true);
    setError('');
    try {
      const data = await receiptRequest(receipt.trip_id, 'POST', { undo_token: undo.token });
      if (!data.trip) throw new Error('Unable to confirm the restored receipt. Please refresh the page.');
      setSavedReceipt(data.trip);
      setUndo(null);
      setNotice('Receipt restored.');
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to restore the receipt. Please try again.'); }
    finally { working(false); }
  }

  if (undo) {
    if (undoExpired) return null;
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 space-y-3">
        <p role="status" className="text-sm text-slate-300">Receipt for {receipt.store_name} deleted. Undo is available for 30 seconds.</p>
        <button ref={undoButtonRef} type="button" disabled={busy} onClick={restoreReceipt} aria-label={`Undo delete for ${receipt.store_name}`} className="min-h-11 rounded-lg border border-emerald-500/40 px-4 py-2 font-bold text-emerald-400 hover:bg-slate-800 disabled:opacity-50">
          {busy ? 'Restoring...' : 'Undo'}
        </button>
        {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <button type="button" aria-label={`View receipt for ${receipt.store_name}`} onClick={event => open('view', event.currentTarget)} className="w-full text-left flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-slate-800/50 transition-colors">
          <div className="min-w-0 flex-1 basis-36">
            <div className="font-bold text-slate-200 break-words">{receipt.store_name}</div>
            <div className="text-xs text-slate-400 mt-1">{formatCalendarDate(receipt.trip_date)}</div>
          </div>
          <div className="max-w-full text-right">
            <div className="font-bold text-emerald-400 break-all">{totalText}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-1">{receipt.final_settled_total === null ? 'Prices saved' : 'Settled'}</div>
          </div>
        </button>
        <div className="flex flex-wrap gap-2 border-t border-slate-800 px-3 py-2">
          <button type="button" aria-label={`${editLabel} for ${receipt.store_name}`} onClick={event => open('edit', event.currentTarget)} className="min-h-11 rounded-lg px-3 py-2 text-sm font-semibold text-emerald-400 hover:bg-slate-800">{editLabel}</button>
          <button type="button" aria-label={`Delete receipt for ${receipt.store_name}`} onClick={event => open('confirm', event.currentTarget)} className="min-h-11 rounded-lg px-3 py-2 text-sm font-semibold text-rose-400 hover:bg-slate-800">Delete receipt</button>
        </div>
        {notice && <p role="status" className="px-4 pb-3 text-xs text-emerald-400">{notice}</p>}
      </div>

      {isOpen && (
        <div role="dialog" aria-modal="true" aria-label={`Receipt for ${receipt.store_name}`} className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-4">
          <div ref={dialogRef} tabIndex={-1} className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl outline-none">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800 p-4 sm:p-6">
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-slate-100 break-words">{receipt.store_name}</h3>
                <p className="mt-1 text-sm text-slate-400">{formatCalendarDate(receipt.trip_date)}</p>
              </div>
              <button type="button" disabled={busy} aria-label="Close receipt" onClick={close} className="h-11 w-11 shrink-0 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50">✕</button>
            </div>
            <div className="min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5">
              {mode === 'confirm' ? (
                <div className="space-y-4">
                  <h4 className="text-lg font-bold text-slate-100">Delete this receipt?</h4>
                  <p className="text-sm text-slate-300">Delete the receipt for {receipt.store_name} from {formatCalendarDate(receipt.trip_date)} ({totalText})? You can Undo for 30 seconds.</p>
                  <p className="text-sm text-slate-400">Your separate spending transaction will stay in the ledger.</p>
                  <div className="flex flex-wrap gap-3">
                    <button data-initial-focus type="button" disabled={busy} onClick={() => { setMode('view'); setError(''); }} className="min-h-11 rounded-xl border border-slate-700 px-4 py-3 text-sm font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-50">Keep receipt</button>
                    <button type="button" disabled={busy} onClick={deleteReceipt} className="min-h-11 rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-white hover:bg-rose-400 disabled:opacity-50">{busy ? 'Deleting...' : 'Confirm delete'}</button>
                  </div>
                </div>
              ) : mode === 'edit' ? (
                <form onSubmit={saveTotal} className="space-y-4">
                  <label htmlFor={`receipt-total-${receipt.trip_id}`} className="block text-sm font-semibold text-slate-200">Final receipt total ($)</label>
                  <input data-initial-focus id={`receipt-total-${receipt.trip_id}`} type="number" min="0.01" step="0.01" required inputMode="decimal" disabled={busy} value={totalInput} onChange={event => setTotalInput(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50" />
                  <p className="text-sm text-slate-400">This changes the receipt total only. Item prices and spending transactions stay the same.</p>
                  <div className="flex flex-wrap gap-3">
                    <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50">{busy ? 'Saving...' : 'Save total'}</button>
                    <button type="button" disabled={busy} onClick={close} className="min-h-11 rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50">Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  {receipt.receipt_items?.length ? receipt.receipt_items.map(item => (
                    <div key={item.id} className="flex justify-between gap-3 border-b border-slate-800 pb-2 text-sm">
                      <span className="min-w-0 break-words text-slate-300">{item.name}</span>
                      <span className="shrink-0 font-semibold text-slate-100">{item.shelfPrice > 0 ? `$${Number(item.shelfPrice).toFixed(2)}` : 'Not entered'}</span>
                    </div>
                  )) : <p className="text-sm text-slate-400">No itemized breakdown available for this receipt.</p>}
                  <div className="flex flex-wrap justify-between gap-3 text-lg font-bold"><span>Total settled</span><span className="break-all text-emerald-400">{totalText}</span></div>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={() => open('edit')} className="min-h-11 rounded-xl border border-slate-700 px-4 py-3 text-sm font-bold text-emerald-400 hover:bg-slate-800">{editLabel}</button>
                    <button type="button" onClick={() => open('confirm')} className="min-h-11 rounded-xl border border-rose-500/30 px-4 py-3 text-sm font-bold text-rose-400 hover:bg-slate-800">Delete receipt</button>
                  </div>
                </>
              )}
              {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
