import Link from "next/link";
import { ArrowSquareOutIcon, EyeSlashIcon, UserIcon } from "@phosphor-icons/react";
import { AccountDetails } from "@/core/types/users";

export default function AccountHeader({ me }: { me: AccountDetails }) {
  const joined = new Date(me.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  return (
    <header className="flex flex-wrap items-center gap-4 rounded-xl border border-secondary-border bg-zinc-900/40 p-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/i/user.png" alt="" className="h-14 w-14 rounded-full border border-secondary-border object-cover" />
      <div className="min-w-0 flex-1">
        <h1 className="flex items-center gap-2 truncate text-xl font-semibold text-zinc-100">
          {me.username}
          {me.private && <EyeSlashIcon size={16} className="shrink-0 text-subtle" aria-label="Private account" />}
        </h1>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-subtle">
          <span style={{ color: me.role.color }}>{me.role.name}</span>
          <span className="text-zinc-700">&bull;</span>
          <span>Joined {joined}</span>
        </p>
      </div>
      <Link
        href={`/users/${encodeURIComponent(me.username)}`}
        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-secondary-border bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-secondary-border hover:text-white"
      >
        <UserIcon size={16} />
        Public profile
        <ArrowSquareOutIcon size={14} className="text-subtle" />
      </Link>
    </header>
  );
}
