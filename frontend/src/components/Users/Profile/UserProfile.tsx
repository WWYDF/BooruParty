'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useUser } from "@/components/UserProvider";
import { useToast } from "@/components/UI/Toast";
import { API } from "@/core/api";
import { hexToRgb } from "@/core/styles/roles";
import { UserProfile as Profile } from "@/core/types/users";
import ProfileBackground from "./ProfileBackground";
import ProfileCollections from "./ProfileCollections";
import ProfileComingSoon from "./ProfileComingSoon";
import ProfileHeader from "./ProfileHeader";
import ProfileRecentPosts from "./ProfileRecentPosts";

export default function UserProfile({ username }: { username: string }) {
  const router = useRouter();
  const toast = useToast();
  const { user: viewer, logout } = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setError(null);

    API(`/api/users/${encodeURIComponent(username)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) return setError(res.status === 404 ? "No user with that name." : "Could not load this profile.");
        setProfile(await res.json());
      })
      .catch(() => { if (!cancelled) setError("The server could not be reached."); });

    return () => { cancelled = true; };
  }, [username]);

  if (error) {
    return (
      <main className="mx-auto mb-24 mt-20 max-w-2xl rounded-2xl border border-zinc-800 bg-secondary p-6">
        <h1 className="text-lg font-semibold text-amber-400">Unable to load profile.</h1>
        <p className="mt-2 text-subtle">{error}</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-accent" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  const isOwner = viewer?.id === profile.id;
  const canModerate = viewer?.permissions.includes("profile.edit.others") ?? false;
  const [r, g, b] = hexToRgb(profile.role.color ?? "#000000");

  const handleLogout = async () => {
    await logout();
    toast("Successfully logged out!", "success");
    router.push("/");
  };

  return (
    <main className="relative min-h-screen pb-20 pt-16">
      <ProfileBackground postId={profile.preferences?.profileBackground ?? null} />

      {isOwner && profile.private && (
        <div className="mx-auto mb-4 mt-8 max-w-6xl">
          <div className="rounded-xl border border-amber-600/30 bg-amber-500/20 px-4 py-3 text-sm text-amber-300">
            Your account is <span className="font-semibold">private</span>. Your posts are hidden from everyone else.
          </div>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mx-auto max-w-6xl space-y-10 rounded-2xl border border-zinc-800 bg-secondary/80 p-6 backdrop-blur"
        style={{ boxShadow: `0 0 20px 2px rgba(${r},${g},${b},0.3)` }}
      >
        <ProfileHeader
          profile={profile}
          isOwner={isOwner}
          canModerate={canModerate}
          onLogout={handleLogout}
          onAvatarReset={() => setProfile({ ...profile, avatar: null })}
        />

        <ProfileRecentPosts username={profile.username} />

        <ProfileCollections username={profile.username} isOwner={isOwner} />
        <ProfileComingSoon title="Recent Comments" description="This user's latest comments will show up here." />
      </motion.div>
    </main>
  );
}
