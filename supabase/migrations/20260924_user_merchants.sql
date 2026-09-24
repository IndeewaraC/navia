-- Migration: Create user_merchants table for Use Case 7 (Reusable Shop List)
-- Description: Stores user-specific merchants for predictive autocomplete in the Quick Expense Modal

CREATE TABLE IF NOT EXISTS public.user_merchants (
    merchant_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    merchant_name TEXT NOT NULL,
    default_category TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, merchant_name) -- Prevent duplicate merchants for the same user
);

-- Enable Row Level Security
ALTER TABLE public.user_merchants ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own merchants
CREATE POLICY "Users can view their own merchants"
    ON public.user_merchants
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own merchants
CREATE POLICY "Users can insert their own merchants"
    ON public.user_merchants
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own merchants
CREATE POLICY "Users can update their own merchants"
    ON public.user_merchants
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own merchants
CREATE POLICY "Users can delete their own merchants"
    ON public.user_merchants
    FOR DELETE
    USING (auth.uid() = user_id);

-- Add a trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_merchants_modtime
    BEFORE UPDATE ON public.user_merchants
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
