'use client';

import { getCurrentUser } from '@/components/serverSide/Users/getCurrentUser';
import { updateUser } from '@/components/serverSide/Users/updateUser';
import { useEffect, useState } from 'react';

export default function InfoForm() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState('');
  
    useEffect(() => {
      (async () => {
        try {
          const user = await getCurrentUser();
          setUsername(user.username || '');
          setEmail(user.email || '');
        } catch (err) {
          setStatus('Could not load user info');
        }
      })();
    }, []);
  
    const save = async () => {
      setStatus('Saving...');
      try {
        await updateUser({ username, email });
        setStatus('Saved ✅');
      } catch (err: any) {
        setStatus(err.message);
      }
    };

    return (
        <section className="bg-secondary p-4 rounded-2xl shadow space-y-4">
        <h2 className="text-xl font-semibold">Account Info</h2>
        <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full p-2 rounded bg-zinc-900 text-white focus:outline-none focus:ring-2 focus:ring-zinc-800"
        />
        <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            className="w-full p-2 rounded bg-zinc-900 text-white focus:outline-none focus:ring-2 focus:ring-zinc-800"
        />
        <button onClick={save} className="bg-darkerAccent text-white px-4 py-2 rounded">Save Info</button>
        <p className="text-sm text-subtle">{status}</p>
        </section>
    );
}
