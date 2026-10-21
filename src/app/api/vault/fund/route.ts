import { createClient } from '@/src/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const FundSchema = z.object({
  project_id: z.string().uuid(),
  amount: z.number().positive().multipleOf(0.01),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
    }

    const body = await request.json();
    const parsedData = FundSchema.parse(body);

    // A contribution records project progress only. No payment account or
    // operational-budget transaction is involved.
    const { data: project, error: projectError } = await supabase
      .from('exempt_projects')
      .select('saved_amount')
      .eq('project_id', parsedData.project_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (projectError) throw new Error('Unable to load project funds.');
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });

    const newSaved = (Math.round(Number(project.saved_amount) * 100) + Math.round(parsedData.amount * 100)) / 100;
    // Compare the previously read amount so simultaneous contributions cannot
    // silently overwrite each other. A conflict can be retried after refreshing.
    const { data: updatedProject, error: updateError } = await supabase
      .from('exempt_projects')
      .update({ saved_amount: newSaved })
      .eq('project_id', parsedData.project_id)
      .eq('user_id', user.id)
      .eq('saved_amount', project.saved_amount)
      .select('project_id, saved_amount')
      .maybeSingle();

    if (updateError) throw new Error('Failed to record project funds.');
    if (!updatedProject) {
      return NextResponse.json({ error: 'Project funds changed. Refresh and try again.' }, { status: 409 });
    }
    return NextResponse.json({ message: 'Project funds recorded successfully', project: updatedProject }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues.map(e => e.message).join(', ') }, { status: 400 });
    }
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to record project funds.' }, { status: 500 });
  }
}
