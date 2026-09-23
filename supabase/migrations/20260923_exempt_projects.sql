-- Create the exempt_projects table
CREATE TABLE IF NOT EXISTS public.exempt_projects (
    project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    saved_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    icon TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for exempt_projects
ALTER TABLE public.exempt_projects ENABLE ROW LEVEL SECURITY;

-- Policies for exempt_projects
CREATE POLICY "Users can view their own exempt projects" 
ON public.exempt_projects FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own exempt projects" 
ON public.exempt_projects FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exempt projects" 
ON public.exempt_projects FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exempt projects" 
ON public.exempt_projects FOR DELETE 
USING (auth.uid() = user_id);

-- Add exempt_project_id to transactions table to link funding events
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS exempt_project_id UUID REFERENCES public.exempt_projects(project_id) ON DELETE SET NULL;
