'use client'

import AvatarUpload from "@/components/clientSide/UserSettings/AvatarUpload";
import InfoForm from "@/components/clientSide/UserSettings/InfoForm";
import PasswordChangeForm from "@/components/clientSide/UserSettings/PasswordForm";
import PreferencesForm from "@/components/clientSide/UserSettings/Preferences";
import { UserSelf } from "@/core/types/users";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";


export default function ProfileSettingsPage() {
  const [user, setUser] = useState<UserSelf | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/users/self");
        if (res.status === 401 || res.status === 403) {
          router.push("/login");
          return;
        }

        if (!res.ok) throw new Error("Failed to fetch user");
        const data: UserSelf = await res.json();
        setUser(data);
      } catch (err) {
        console.error(err);
        router.push("/login");
      }
    };

    fetchUser();
  }, [router]);

  if (!user) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  return (
    <motion.div
      className="max-w-6xl mx-auto p-6"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <h1 className="text-3xl font-bold text-accent mb-8">Profile Settings</h1>
      <a
        href={`/users/${user.username}`}
        className="inline-block mb-6 px-4 py-2 text-sm font-medium bg-zinc-900 text-accent rounded-md border border-zinc-800 hover:bg-zinc-950 hover:border-black transition"
      >
        View My Public Profile →
      </a>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <InfoForm user={user} />
          <PasswordChangeForm user={user} />
        </motion.div>

        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <AvatarUpload user={user} />
          <PreferencesForm user={user} />
        </motion.div>
      </div>
    </motion.div>
  );
}