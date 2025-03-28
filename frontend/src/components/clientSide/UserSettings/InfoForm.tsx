'use client';

import { useState } from 'react';

export default function InfoForm() {
  const [username, setUsername] = useState('yourname');
  const [email, setEmail] = useState('you@example.com');

  return (
    <section className="bg-secondary-border p-4 rounded-2xl shadow space-y-4">
      <h2 className="text-xl font-semibold">Account Info</h2>
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
        className="w-full p-2 rounded bg-secondary text-white"
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        type="email"
        className="w-full p-2 rounded bg-secondary text-white"
      />
      <button className="bg-accent text-white px-4 py-2 rounded">Save Info</button>
    </section>
  );
}
