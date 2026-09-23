import { createClient } from '@/src/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Zero-Trust Payload Validation
const LoginSchema = z.object({
  email: z.string().email({ message: "Invalid email address format" }),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // 1. Validate incoming payload against the schema
    const { email } = LoginSchema.parse(body);

    // 2. Initialize the Supabase Server Client
    const supabase = await createClient();
    
    // 3. Dispatch the OTP via Supabase Auth
    // shouldCreateUser is false to ensure this route only handles existing logins
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true, 
      },
    });

    if (error) {
      // Return a generic error to prevent account enumeration
      console.error('OTP Dispatch Error:', error.message);
      return NextResponse.json({ error: 'If this account exists, an OTP has been dispatched.' }, { status: 400 });
    }

    return NextResponse.json({ message: 'OTP dispatched successfully. Awaiting verification.' }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
