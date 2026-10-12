-- Unknown grocery totals remain NULL; partial shelf prices are not a settled total.
ALTER TABLE public.grocery_trips
  ALTER COLUMN final_settled_total DROP NOT NULL;

-- Transaction dates are entered as calendar dates. Use creation time to order
-- entries within the same date, without changing their accounting date.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS transactions_user_date_created_idx
  ON public.transactions (user_id, transaction_date DESC, created_at DESC);
