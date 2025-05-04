'use client';

import { updateUser } from '@/components/serverSide/Users/updateUser';
import { useEffect, useState } from 'react';
import { useToast } from '../Toast';
import { Trash } from 'phosphor-react';
import { motion, AnimatePresence } from "framer-motion";
import { UserSelf } from '@/core/types/users';

export default function InfoForm({ user }: { user: UserSelf }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"delete" | "transfer">("transfer");
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        setUsername(user.username || '');
        setEmail(user.email || '');
        setDescription(user.description || '');
      } catch (err) {
        toast('Could not load user info', 'error');
      }
    })();
  }, []);

  const save = async () => {
    try {
      await updateUser(username, { username, email, description });
      toast('Saved!', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  return (
    <>
      <section className="relative bg-secondary p-4 rounded-2xl shadow space-y-4">
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
        <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="About Me"
            type="text"
            className="w-full p-2 rounded bg-zinc-900 text-white focus:outline-none focus:ring-2 focus:ring-zinc-800"
        />
        <button onClick={save} className="bg-darkerAccent hover:bg-darkerAccent/80 transition text-white px-4 py-2 rounded">Save Info</button>

        {/* Trash button */}
        <button
          onClick={() => setShowConfirm(true)}
          className="absolute bottom-4 right-4 bg-red-600 hover:bg-red-700 transition text-white p-2 rounded-md shadow"
          title="Delete Account"
        >
          <Trash size={20} weight="bold" />
        </button>
      </section>

      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="bg-zinc-900 p-6 rounded-lg shadow-xl w-full max-w-sm text-white space-y-4"
            >
              <h2 className="text-lg font-semibold">Delete Account</h2>
              <p className="text-sm text-subtle">
                Are you sure you want to delete your account? This cannot be undone.
              </p>

              <fieldset className="space-y-2 mt-2">
                <legend className="text-sm font-medium mb-1">What should we do with your posts?</legend>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="deleteMode"
                    value="delete"
                    checked={deleteMode === "delete"}
                    onChange={() => setDeleteMode("delete")}
                    className="accent-red-600"
                  />
                  Delete all my posts
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="deleteMode"
                    value="transfer"
                    checked={deleteMode === "transfer"}
                    onChange={() => setDeleteMode("transfer")}
                    className="accent-orange-500"
                  />
                  Transfer them to system account
                </label>
              </fieldset>

              <div className="flex justify-end gap-4 pt-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-4 py-2 bg-zinc-700 rounded hover:bg-zinc-600 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setDeleting(true);
                    const res = await fetch(`/api/users/${user.username}/delete?mode=${deleteMode}`, {
                      method: "DELETE",
                    });

                    if (res.status === 204) {
                      toast("Account deleted", "success");
                      setTimeout(() => {
                        window.location.reload();
                      }, 1000);
                    } else {
                      toast("Failed to delete account", "error");
                      setDeleting(false);
                      setShowConfirm(false);
                    }
                  }}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 transition rounded text-white"
                >
                  {deleting ? "Deleting..." : "Yes, delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
