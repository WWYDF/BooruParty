'use client';

import { updateUser } from '@/components/serverSide/Users/updateUser';
import { useState } from 'react';

export default function PasswordChangeForm() {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [status, setStatus] = useState('');
  
    const save = async () => {
      if (password !== confirm) {
        setStatus('Passwords do not match');
        return;
      }
  
      setStatus('Updating...');
      try {
        await updateUser({ password });
        setPassword('');
        setConfirm('');
        setStatus('Password updated ✅');
      } catch (err: any) {
        setStatus(err.message);
      }
    };

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
        <button onClick={save} className="bg-darkerAccent text-white px-4 py-2 rounded">Update Password</button>
        <p className="text-sm text-subtle">{status}</p>
        </section>
    );
}
