'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to request OTP');
      }

      setSuccess(true);
      // Wait a moment so the user sees the success state, then route to OTP verification
      setTimeout(() => {
        router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
      }, 1500);

    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 font-sans text-slate-100 selection:bg-emerald-500/30">
      <div className="w-full max-w-md">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
          
          <div className="mb-8 text-center space-y-4">
            <h1 className="text-3xl font-bold tracking-tight text-slate-100">
              Navia
            </h1>
            <div className="text-4xl">
              🔒
            </div>
            <p className="text-sm text-slate-400 font-medium">
              Zero-Knowledge Privacy Vault
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-colors"
                placeholder="you@example.com"
                disabled={loading || success}
              />
            </div>

            {error && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                Code dispatched successfully. Redirecting...
              </div>
            )}

            <button
              type="submit"
              disabled={loading || success}
              className="w-full flex items-center justify-center rounded-lg bg-emerald-500 text-slate-950 font-bold py-3 px-4 hover:bg-emerald-400 transition-colors disabled:opacity-70"
            >
              {loading ? 'Sending Code...' : 'Request Secure Code'}
            </button>
          </form>
          
        </div>
      </div>
    </div>
  );
}
