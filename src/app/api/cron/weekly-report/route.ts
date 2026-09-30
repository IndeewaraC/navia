import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function GET(request: Request) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_key'
  );
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
      
      // 4. Send the Email via Gmail SMTP
      await transporter.sendMail({
        from: `"Navia Engine" <${process.env.GMAIL_USER}>`,
        to: profile.email,
        subject: 'Your Navia Weekly Stability Report',
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
