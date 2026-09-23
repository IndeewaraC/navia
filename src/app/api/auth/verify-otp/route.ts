import { createClient } from '@/src/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Zero-Trust Payload Validation
const VerifySchema = z.object({
  email: z.string().email({ message: 'Invalid email address format' }),
  token: z.string().length(6, { message: 'OTP must be exactly 6 digits' }),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // 1. Validate incoming payload against the schema
    const { email, token } = VerifySchema.parse(body);

    // 2. Initialize the Supabase Server Client
    const supabase = await createClient();
    
    // 3. Verify the OTP
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (error) {
      console.error('OTP Verification Error:', error.message);
      return NextResponse.json(
        { error: 'Invalid or expired OTP. Please try again.' }, 
        { status: 401 }
      );
    }

    // Next.js middleware and @supabase/ssr will handle setting the JWT cookies securely automatically
    return NextResponse.json(
      { message: 'Authentication successful', user: data.user }, 
      { status: 200 }
    );
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
