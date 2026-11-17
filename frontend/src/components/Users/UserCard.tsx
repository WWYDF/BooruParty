import Link from "next/link";
import { EyeSlashIcon } from "@phosphor-icons/react";
import { RoleBadge } from "@/components/RoleBadge";
import { formatRelativeTime } from "@/core/formats";
import { UserSimpleSummary } from "@/core/types/users";

export default function UserCard({ user }: { user: UserSimpleSummary }) {
  return (
    <Link
      href={`/users/${encodeURIComponent(user.username)}`}
      className="flex cursor-pointer flex-col items-center rounded-xl bg-secondary p-6 py-8 text-center transition-colors hover:bg-zinc-900"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={user.avatar ?? "/i/user.png"}
        alt={user.username}
        loading="lazy"
        className="mb-3 h-20 w-20 rounded-full object-cover"
      />

      <div className="flex max-w-full items-center justify-center font-semibold text-accent">
        <span className="truncate">{user.username}</span>
        {user.private && <EyeSlashIcon size={14} className="ml-1.5 shrink-0 text-subtle" aria-label="Private account" />}
        <RoleBadge role={user.role} />
      </div>

      {user.about && (
        <div className="mb-1 mt-1 max-w-[90%] break-words text-xs italic text-zinc-600">{user.about}</div>
      )}

      {/* Dates arrive as JSON strings */}
      <div className="mt-1 text-sm text-subtle">Last seen: {formatRelativeTime(String(user.updatedAt))}</div>
      <div className="text-sm text-subtle">Registered: {formatRelativeTime(String(user.createdAt))}</div>
    </Link>
  );
}
