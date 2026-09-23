import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// We use the Service Role Key here because this is a system-level background job
// operating outside of a specific user's active browser session.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  // 1. Secure the Cron Endpoint
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Fetch users who want reports today (e.g., Sunday = 0)
    const today = new Date().getDay();
    
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, display_name')
      .eq('report_delivery_day', today);
      
    if (profileError || !profiles) throw new Error('Failed to fetch profiles');

    // 3. Generate and dispatch reports
    // In a production environment, you would batch these or use a queue for scale
    for (const profile of profiles) {
      // Calculate start of week
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - 7);
      
      const { data: transactions } = await supabaseAdmin
        .from('transactions')
        .select('amount, category')
        .eq('user_id', profile.id)
        .eq('txn_type', 'EXPENSE')
        .gte('transaction_date', startOfWeek.toISOString());
        
      const weeklySpend = transactions?.reduce((sum, txn) => sum + Number(txn.amount), 0) || 0;
      
      // 4. Send the Email via Resend
      await resend.emails.send({
        from: 'Navia Vault <reports@navia.app>',
        to: profile.email,
        subject: 'Your Weekly Survival Runway',
        html: `
          <h1>Navia Weekly Summary</h1>
          <p>Hi ${profile.display_name || 'there'},</p>
          <p>Here is your operational ledger for the past 7 days:</p>
          <h2>$${weeklySpend.toFixed(2)}</h2>
          <p>Total Operational Spend</p>
          <hr />
          <p><small>Keep an eye on upcoming bill deadlines to ensure your next paycheck covers the gap.</small></p>
        `
      });
    }

    return NextResponse.json({ message: `Successfully dispatched ${profiles.length} reports.` });
  } catch (error: any) {
    console.error('Cron Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
