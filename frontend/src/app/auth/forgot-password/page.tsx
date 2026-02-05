'use client';

import { useToast } from '@/components/clientSide/Toast';
import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        toast('Something went wrong. Please try again.', 'error');
      }
    } catch {
      toast('Something went wrong. Please try again.', 'error');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-md flex flex-col items-center">
        {submitted ? (
          <div className="bg-secondary border border-secondary-border p-6 rounded-xl w-full space-y-4">
            <h1 className="text-xl font-bold text-neutral-400">Check Your Email</h1>
            <p className="text-neutral-400">
              If an account exists with that email, we've sent password reset instructions.
            </p>
            <a
              href="/auth/login"
              className="block w-full py-2 bg-green-600 text-white rounded hover:opacity-90 transition text-center"
            >
              Back to Login
            </a>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-secondary border border-secondary-border p-6 rounded-xl w-full space-y-4"
          >
            <h1 className="text-xl font-bold text-neutral-400">Forgot Password</h1>
            <p className="text-sm text-neutral-500">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <input
              type="email"
              name="email"
              placeholder="Email"
              className="w-full p-2 bg-background border border-secondary-border bg-zinc-900 text-white rounded focus:outline-none focus:ring-1 focus:ring-zinc-700"
              onChange={(e) => setEmail(e.target.value)}
              value={email}
              required
              maxLength={128}
            />

            <button
              type="submit"
              className="w-full py-2 bg-green-600 text-white rounded hover:opacity-90 transition"
            >
              Send Reset Link
            </button>
          </form>
        )}

        <p className="text-sm text-subtle mt-4">
          Remember your password?{" "}
          <a href="/auth/login" className="text-accent hover:underline">
            Login
          </a>
        </p>
      </div>
    </main>
  );
}
