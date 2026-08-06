'use client';

import { useToast } from '@/components/clientSide/Toast';
import { useState } from 'react';

export default function PasswordResetPage() {
  const [step, setStep] = useState<'email' | 'verify' | 'password' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const toast = useToast();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setStep('verify');
      } else {
        toast('Something went wrong. Please try again.', 'error');
      }
    } catch {
      toast('Something went wrong. Please try again.', 'error');
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch('/api/auth/password-reset/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      if (res.ok) {
        setStep('password');
      } else {
        const data = await res.json();
        toast(data.error || 'Something went wrong. Please try again.', 'error');
      }
    } catch {
      toast('Something went wrong. Please try again.', 'error');
    }
  };

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
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
        body: JSON.stringify({ email, code, password: form.password }),
      });

      if (res.ok) {
        setStep('done');
      } else {
        const data = await res.json();
        toast(data.error || 'Something went wrong. Please try again.', 'error');
      }
    } catch {
      toast('Something went wrong. Please try again.', 'error');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-md flex flex-col items-center">
        {step === 'email' && (
          <form
            onSubmit={handleEmailSubmit}
            className="bg-secondary border border-secondary-border p-6 rounded-xl w-full space-y-4"
          >
            <h1 className="text-xl font-bold text-neutral-400">Reset Password</h1>
            <p className="text-sm text-neutral-500">
              Enter your email address and we'll send you a verification code before you can reset your password.
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
              Send Code
            </button>
          </form>
        )}

        {step === 'verify' && (
          <form
            onSubmit={handleVerifySubmit}
            className="bg-secondary border border-secondary-border p-6 rounded-xl w-full space-y-4"
          >
            <h1 className="text-xl font-bold text-neutral-400">Enter Verification Code</h1>
            <p className="text-sm text-neutral-500">
              If an account exists for <code>{email}</code>, a 6-digit code has been sent. Please paste that code here.
            </p>

            <input
              type="text"
              name="code"
              placeholder="6-digit code"
              inputMode="numeric"
              className="w-full p-2 bg-background border border-secondary-border bg-zinc-900 text-white rounded focus:outline-none focus:ring-1 focus:ring-zinc-700 tracking-widest text-center text-lg"
              onChange={handleCodeChange}
              value={code}
              required
              maxLength={6}
              autoFocus
            />

            <button
              type="submit"
              className="w-full py-2 bg-green-600 text-white rounded hover:opacity-90 transition"
            >
              Verify Code
            </button>

            <button
              type="button"
              onClick={() => setStep('email')}
              className="w-full text-sm text-subtle hover:underline"
            >
              Use a different email
            </button>
          </form>
        )}

        {step === 'password' && (
          <form
            onSubmit={handlePasswordSubmit}
            className="bg-secondary border border-secondary-border p-6 rounded-xl w-full space-y-4"
          >
            <h1 className="text-xl font-bold text-neutral-400">New Password</h1>
            <p className="text-sm text-neutral-500">
              Enter your new password below.
            </p>

            <input
              type="password"
              name="password"
              placeholder="New Password"
              className="w-full p-2 bg-background border border-secondary-border bg-zinc-900 text-white rounded focus:outline-none focus:ring-1 focus:ring-zinc-700"
              onChange={handleFieldChange}
              value={form.password}
              required
              minLength={8}
              maxLength={128}
              autoFocus
            />

            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm Password"
              className="w-full p-2 bg-background border border-secondary-border bg-zinc-900 text-white rounded focus:outline-none focus:ring-1 focus:ring-zinc-700"
              onChange={handleFieldChange}
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

        {step === 'done' && (
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
