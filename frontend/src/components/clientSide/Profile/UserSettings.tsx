'use client';

import { motion } from 'framer-motion';
import InfoForm from './InfoForm';
import AvatarUpload from './AvatarUpload';
import PreferencesForm from './Preferences';
import PasswordChangeForm from './PasswordForm';
import { UserSelf } from '@/core/types/users';
import UserEditingForm from './AdminForm';
import SafetyForm from './Safety';

export default function UserSettingsClient({ user, impersonating }: {
  user: UserSelf;
  impersonating: boolean;
}) {
  return (
    <motion.div
      className="max-w-[90%] mx-auto p-6"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {impersonating && (
        <div className="mb-4 p-3 rounded-md bg-yellow-900 text-yellow-200 text-sm border border-yellow-700">
          You are editing <strong>{user.username}</strong>'s profile.
        </div>
      )}

      <h1 className="text-3xl font-bold text-accent mb-8">User Settings</h1>

      <a
        href={`/users/${user.username}`}
        className="inline-block mb-6 px-4 py-2 text-sm font-medium bg-zinc-900 text-accent rounded-md border border-zinc-800 hover:bg-zinc-950 hover:border-black transition"
      >
        View Public Profile →
      </a>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <InfoForm user={user} />
          <PasswordChangeForm user={user} />
          {impersonating && (
            <UserEditingForm user={user} />
          )}
        </motion.div>

        {/* Right Column */}
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <AvatarUpload user={user} />
          <SafetyForm user={user} />
          <PreferencesForm user={user} />
        </motion.div>
      </div>
    </motion.div>
  );
}
