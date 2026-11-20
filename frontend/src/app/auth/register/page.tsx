'use client';

import { useToast } from '@/components/UI/Toast';
import { useUser } from '@/components/UserProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { API, errorText } from '@/core/api';

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
  });

  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const { user, setUser } = useUser();

  useEffect(() => {
    if (user) router.replace('/posts');
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await API('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        toast(errorText(data), 'error');
        return;
      }

      toast('Account created!', 'success');
      setUser(data); // triggers the redirect effect above
    } catch {
      toast('Could not reach the server', 'error');
    } finally {
      setLoading(false);
    }
  };


  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-md flex flex-col items-center">
        <form
          onSubmit={handleSubmit}
          className="bg-secondary border border-secondary-border p-6 rounded-xl w-full space-y-4"
        >
          <h1 className="text-xl font-bold text-neutral-400">Register Page</h1>
  
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
            type="text"
            name="username"
            placeholder="Username"
            className="w-full p-2 bg-background border border-secondary-border bg-zinc-900 text-white rounded focus:outline-none focus:ring-1 focus:ring-zinc-700"
            onChange={handleChange}
            value={form.username}
            required
            maxLength={24}
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
            className="w-full py-2 cursor-pointer bg-green-600 text-white rounded hover:opacity-90 transition"
            disabled={loading}
          >
            {loading ? 'Registering...' : 'Register'}
          </button>  
        </form>
  
        <p className="text-sm text-subtle mt-4">
          Already have an account?{" "}
          <a href="/auth/login" className="text-accent hover:underline">
            Login
          </a>
        </p>
      </div>
    </main>
  );
}  
