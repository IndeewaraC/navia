'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Suspense } from 'react';

function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email');

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect to login if accessed directly without an email parameter
  useEffect(() => {
    if (!email) {
      router.replace('/login');
    }
  }, [email, router]);

  // Handle the 60-second resend cooldown timer
  useEffect(() => {
    if (timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timerId);
    }
  }, [timeLeft]);

  const handleChange = (index: number, value: string) => {
    if (!/^[0-9]*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Auto-advance to the next input field
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Auto-retreat to the previous input field on backspace
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = otp.join('');
    
    if (token.length !== 6) {
      setError('Please enter all 6 digits.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Verification failed');

      // Success: Proxy has set the HTTP-only cookie. Route to command center.
      router.push('/ledger');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timeLeft > 0) return;
    setTimeLeft(60);
    // Trigger the /api/auth/login endpoint again to dispatch a new code
    try {
      await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch (err) {
      console.error('Failed to resend code', err);
    }
  };

  // Prevent render flash if no email is present
  if (!email) return null;

  return (
    <div className="w-full max-w-md">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl transition-all duration-300">
        
        <div className="mb-8 text-center space-y-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            Verify your identity
          </h1>
          <p className="text-sm text-slate-400 font-medium">
            We sent a 6-digit secure code to<br />
            <span className="text-emerald-400 font-semibold mt-1 inline-block">{email}</span>
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-8">
          <div className="flex justify-between gap-2">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                disabled={loading}
                className="w-12 h-14 text-center text-xl font-bold bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-colors disabled:opacity-50"
                aria-label={`Digit ${index + 1}`}
              />
            ))}
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || otp.join('').length !== 6}
            className="w-full flex items-center justify-center rounded-lg bg-emerald-500 text-slate-950 font-bold py-3 px-4 hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : 'Access Vault'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={handleResend}
            disabled={timeLeft > 0 || loading}
            className={`${timeLeft > 0 ? 'text-slate-500 cursor-not-allowed' : 'text-emerald-400 hover:text-emerald-300'} transition-colors font-medium`}
          >
            {timeLeft > 0 ? `Resend code in 0:${timeLeft.toString().padStart(2, '0')}` : 'Resend secure code'}
          </button>
        </div>
        
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 font-sans text-slate-100 selection:bg-emerald-500/30">
      <Suspense fallback={
        <div className="w-full max-w-md text-center">
          <div className="animate-spin inline-block w-8 h-8 border-[3px] border-current border-t-transparent text-emerald-500 rounded-full" role="status" aria-label="loading"></div>
        </div>
      }>
        <VerifyOtpForm />
      </Suspense>
    </div>
  );
}
