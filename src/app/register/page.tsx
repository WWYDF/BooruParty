'use client';

import { useState } from 'react';

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(data.error || 'Something went wrong');
    } else {
      setMessage('Successfully registered!');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <form onSubmit={handleSubmit} className="bg-secondary border border-secondary-border p-6 rounded-xl w-full max-w-md space-y-4">
        <h1 className="text-xl font-bold text-accent">Register</h1>

        <input
          type="email"
          name="email"
          placeholder="Email"
          className="w-full p-2 bg-background border border-secondary-border rounded"
          onChange={handleChange}
          value={form.email}
          required
        />

        <input
          type="text"
          name="username"
          placeholder="Username"
          className="w-full p-2 bg-background border border-secondary-border rounded"
          onChange={handleChange}
          value={form.username}
          required
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          className="w-full p-2 bg-background border border-secondary-border rounded"
          onChange={handleChange}
          value={form.password}
          required
        />

        <button
          type="submit"
          className="w-full py-2 bg-accent text-white rounded hover:opacity-90 transition"
          disabled={loading}
        >
          {loading ? 'Registering...' : 'Register'}
        </button>

        {message && <p className="text-subtle text-sm mt-2">{message}</p>}
      </form>
    </main>
  );
}
