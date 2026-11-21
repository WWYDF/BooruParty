'use client';

import Link from "next/link";
import { useState } from "react";
import { EyeSlashIcon, GearSixIcon, SignOutIcon, UserCircleMinusIcon } from "@phosphor-icons/react";
import { RoleBadge } from "@/components/RoleBadge";
import ConfirmModal from "@/components/UI/Modals/ConfirmModal";
import { useToast } from "@/components/UI/Toast";
import { API, errorText } from "@/core/api";
import { formatRelativeTime } from "@/core/formats";
import { UserProfile } from "@/core/types/users";

const actionClass =
  "inline-flex w-full cursor-pointer items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm font-medium transition-colors hover:border-black hover:bg-zinc-950";

export default function ProfileHeader({ profile, isOwner, canModerate, onLogout, onAvatarReset }: {
  profile: UserProfile;
  isOwner: boolean;
  canModerate: boolean; // profile.edit.others
  onLogout: () => void;
  onAvatarReset: () => void;
}) {
  const toast = useToast();
  const [confirmReset, setConfirmReset] = useState(false);

  const resetAvatar = async () => {
    setConfirmReset(false);
    try {
      const res = await API(`/api/avatars/reset?userId=${encodeURIComponent(profile.id)}`, { method: "DELETE" });
      if (!res.ok) return toast(errorText(await res.json().catch(() => ({}))), "error");
      toast(`Reset ${profile.username}'s avatar`, "success");
      onAvatarReset();
    } catch {
      toast("The server could not be reached", "error");
    }
  };

  const showModeration = canModerate && !isOwner && profile.avatar;

  return (
    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[100px_1fr_auto]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={profile.avatar ?? "/i/user.png"} alt={profile.username} className="h-24 w-24 rounded-full object-cover shadow-lg" />

      <div className="min-w-0">
        <div className="flex items-center text-2xl font-bold text-accent">
          <span className="truncate">{profile.username}</span>
          {profile.private && <EyeSlashIcon size={18} className="ml-2 shrink-0 text-subtle" aria-label="Private account" />}
          <RoleBadge role={profile.role} />
        </div>

        {profile.about && (
          <p className="mb-2 mt-1 inline-block max-w-full wrap-break-word rounded bg-zinc-800 px-2 text-sm italic text-subtle">{profile.about}</p>
        )}
        {/* Dates arrive as JSON strings */}
        <div className="text-sm text-subtle">Last seen: {formatRelativeTime(String(profile.updatedAt))}</div>
        <div className="text-xs text-subtle">Member Since: {new Date(String(profile.createdAt)).toLocaleDateString()}</div>
      </div>

      {(isOwner || showModeration) && (
        <div className="flex flex-col gap-2">
          {isOwner && (
            <>
              <Link href="/account" className={`${actionClass} text-accent`}>
                <GearSixIcon size={16} weight="bold" />
                Edit Profile
              </Link>
              <button onClick={onLogout} className={`${actionClass} text-red-500`}>
                <SignOutIcon size={16} weight="bold" />
                Log out
              </button>
            </>
          )}
          {showModeration && (
            <button onClick={() => setConfirmReset(true)} className={`${actionClass} text-amber-400`}>
              <UserCircleMinusIcon size={16} weight="bold" />
              Reset avatar
            </button>
          )}
        </div>
      )}

      <ConfirmModal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={resetAvatar}
        title={`Reset ${profile.username}'s avatar?`}
        description="Their avatar goes back to the default. The old image is deleted."
        confirmText="Reset"
        cancelText="Cancel"
      />
    </div>
  );
}
