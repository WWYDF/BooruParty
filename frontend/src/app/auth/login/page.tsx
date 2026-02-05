'use client';

import { useToast } from '@/components/clientSide/Toast';
import { getSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    const checkSession = async () => {
      const session = await getSession();
      if (session) {
        router.replace('/posts');
        toast('You have been logged in.', 'success');
      }
    };
  
    checkSession();
  }, []);

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
      router.push('/posts');
      setTimeout(() => {
        window.location.reload();
      }, 100);
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
            maxLength={128}
          />
  
          <input
            type="password"
            name="password"
            placeholder="Password"
            className="w-full p-2 bg-background border border-secondary-border bg-zinc-900 text-white rounded focus:outline-none focus:ring-1 focus:ring-zinc-700"
            onChange={handleChange}
            value={form.password}
            required
            maxLength={128}
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
          <a href="/auth/register" className="text-accent hover:underline">
            Register
          </a>
          {" | "}
          <a href="/auth/forgot-password" className="text-accent hover:underline">
            Forgot password?
          </a>
        </p>
      </div>
    </main>
  );    
}
