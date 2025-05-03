'use client';

import { useToast } from '@/components/clientSide/Toast';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const router = useRouter();
  const toast = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await signIn('credentials', {
      redirect: false,
      email: form.email,
      password: form.password,
    });

    if (res?.error) {
      toast('Unable to sign in.', 'error');
    } else {
      await new Promise((r) => setTimeout(r, 100));
      router.push('/posts');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-md flex flex-col items-center">
        <form
          onSubmit={handleSubmit}
          className="bg-secondary border border-secondary-border p-6 rounded-xl w-full space-y-4"
        >
          <h1 className="text-xl font-bold text-neutral-400">Login Page</h1>
  
          <input
            type="email"
            name="email"
            placeholder="Email"
            className="w-full p-2 bg-background border border-secondary-border bg-zinc-900 text-white rounded focus:outline-none focus:ring-1 focus:ring-zinc-700"
            onChange={handleChange}
            value={form.email}
            required
          />
  
          <input
            type="password"
            name="password"
            placeholder="Password"
            className="w-full p-2 bg-background border border-secondary-border bg-zinc-900 text-white rounded focus:outline-none focus:ring-1 focus:ring-zinc-700"
            onChange={handleChange}
            value={form.password}
            required
          />
  
          <button
            type="submit"
            className="w-full py-2 bg-green-600 text-white rounded hover:opacity-90 transition"
          >
            Login
          </button>
        </form>
  
        <p className="text-sm text-subtle mt-4">
          Don't have an account?{" "}
          <a href="/register" className="text-accent hover:underline">
            Register
          </a>
        </p>
      </div>
    </main>
  );    
}
