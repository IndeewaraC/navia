ALTER TABLE IF EXISTS public.grocery_trips 
ADD COLUMN IF NOT EXISTS receipt_items JSONB;
