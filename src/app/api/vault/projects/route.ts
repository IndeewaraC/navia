import { createClient } from '@/src/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const ProjectSchema = z.object({
  name: z.string().min(1),
  target_amount: z.number().positive(),
  icon: z.string().optional(),
});

const EditProjectSchema = ProjectSchema.extend({
  project_id: z.string().uuid()
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
    }

    const body = await request.json();
    const parsedData = ProjectSchema.parse(body);

    const { data, error } = await supabase
      .from('exempt_projects')
      .insert({
        user_id: user.id,
        name: parsedData.name,
        target_amount: parsedData.target_amount,
        icon: parsedData.icon || '🎯',
        saved_amount: 0
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ message: 'Project created', data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues.map(e => e.message).join(', ') }, { status: 400 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
    }

    const body = await request.json();
    const parsedData = EditProjectSchema.parse(body);

    const { data, error } = await supabase
      .from('exempt_projects')
      .update({
        name: parsedData.name,
        target_amount: parsedData.target_amount,
        icon: parsedData.icon || '🎯'
      })
      .eq('project_id', parsedData.project_id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ message: 'Project updated', data }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues.map(e => e.message).join(', ') }, { status: 400 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
