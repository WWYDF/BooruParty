'use client';

import { useState } from 'react';

export default function PasswordChangeForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  return (
    <section className="bg-secondary p-4 rounded-2xl shadow space-y-4">
      <h2 className="text-xl font-semibold">Change Password</h2>
      <input
        type="password"
        placeholder="New Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full p-2 rounded bg-zinc-900 text-white focus:outline-none focus:ring-2 focus:ring-zinc-800"
      />
      <input
        type="password"
        placeholder="Confirm Password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="w-full p-2 rounded bg-zinc-900 text-white focus:outline-none focus:ring-2 focus:ring-zinc-800"
      />
      <button className="bg-darkerAccent text-white px-4 py-2 rounded">Update Password</button>
    </section>
  );
}
