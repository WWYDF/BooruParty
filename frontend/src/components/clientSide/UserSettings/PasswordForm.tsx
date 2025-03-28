'use client';

import { useState } from 'react';

export default function PasswordChangeForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  return (
    <section className="bg-secondary-border p-4 rounded-2xl shadow space-y-4">
      <h2 className="text-xl font-semibold">Change Password</h2>
      <input
        type="password"
        placeholder="New Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full p-2 rounded bg-secondary text-white"
      />
      <input
        type="password"
        placeholder="Confirm Password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="w-full p-2 rounded bg-secondary text-white"
      />
      <button className="bg-accent text-white px-4 py-2 rounded">Update Password</button>
    </section>
  );
}
