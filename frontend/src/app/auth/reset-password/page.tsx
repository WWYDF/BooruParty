'use client';

import { useToast } from '@/components/clientSide/Toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';

function ResetPasswordForm() {
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const toast = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast('Passwords do not match.', 'error');
      return;
    }

    if (form.password.length < 8) {
      toast('Password must be at least 8 characters.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: form.password }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        toast(data.error || 'Something went wrong. Please try again.', 'error');
      }
    } catch {
      toast('Something went wrong. Please try again.', 'error');
    }
  };

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="w-full max-w-md flex flex-col items-center">
          <div className="bg-secondary border border-secondary-border p-6 rounded-xl w-full space-y-4">
            <h1 className="text-xl font-bold text-neutral-400">Invalid Link</h1>
            <p className="text-neutral-400">
              This password reset link is invalid or has expired.
            </p>
            <a
              href="/auth/forgot-password"
              className="block w-full py-2 bg-green-600 text-white rounded hover:opacity-90 transition text-center"
            >
              Request New Link
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-md flex flex-col items-center">
        {submitted ? (
          <div className="bg-secondary border border-secondary-border p-6 rounded-xl w-full space-y-4">
            <h1 className="text-xl font-bold text-neutral-400">Password Reset</h1>
            <p className="text-neutral-400">
              Your password has been reset successfully.
            </p>
            <a
              href="/auth/login"
              className="block w-full py-2 bg-green-600 text-white rounded hover:opacity-90 transition text-center"
            >
              Login
            </a>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-secondary border border-secondary-border p-6 rounded-xl w-full space-y-4"
          >
            <h1 className="text-xl font-bold text-neutral-400">Reset Password</h1>
            <p className="text-sm text-neutral-500">
              Enter your new password below.
            </p>

            <input
              type="password"
              name="password"
              placeholder="New Password"
              className="w-full p-2 bg-background border border-secondary-border bg-zinc-900 text-white rounded focus:outline-none focus:ring-1 focus:ring-zinc-700"
              onChange={handleChange}
              value={form.password}
              required
              minLength={8}
              maxLength={128}
            />

            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm Password"
              className="w-full p-2 bg-background border border-secondary-border bg-zinc-900 text-white rounded focus:outline-none focus:ring-1 focus:ring-zinc-700"
              onChange={handleChange}
              value={form.confirmPassword}
              required
              minLength={8}
              maxLength={128}
            />

            <button
              type="submit"
              className="w-full py-2 bg-green-600 text-white rounded hover:opacity-90 transition"
            >
              Reset Password
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="w-full max-w-md flex flex-col items-center">
          <div className="bg-secondary border border-secondary-border p-6 rounded-xl w-full space-y-4">
            <p className="text-neutral-400">Loading...</p>
          </div>
        </div>
      </main>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
