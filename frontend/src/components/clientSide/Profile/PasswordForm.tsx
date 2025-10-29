'use client';

import { updateUser } from '@/components/serverSide/Users/updateUser';
import { useState } from 'react';
import { useToast } from '../Toast';
import { UserSelf } from '@/core/types/users';
import { motion } from 'framer-motion';

export default function PasswordChangeForm({ user }: { user: UserSelf }) {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const toast = useToast();
  
    const save = async () => {
      if (password !== confirm) {
        toast('Passwords do not match', 'error');
        return;
      }
  
      try {
        await updateUser(user.username, { password });
        setPassword('');
        setConfirm('');
        toast('Password Updated!', 'success');
      } catch (err: any) {
        toast(`Error: ${err.message}`, 'error');
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
            maxLength={128} // To avoid overflow lol
        />
        <input
            type="password"
            placeholder="Confirm Password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full p-2 rounded bg-zinc-900 text-white focus:outline-none focus:ring-2 focus:ring-zinc-800"
            maxLength={128}
        />
        <motion.button
          onClick={() => save}
          whileTap={{ scale: 0.98 }}
          className="cursor-pointer rounded bg-darkerAccent px-4 py-2 text-white transition hover:bg-darkerAccent/80 focus:outline-none"
        >
          Update Password
        </motion.button>
        </section>
    );
}
