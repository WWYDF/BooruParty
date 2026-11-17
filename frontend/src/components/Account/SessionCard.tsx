'use client';

import { SignOutIcon, TrashIcon } from "@phosphor-icons/react";
import Button from "@/components/UI/Button";
import { AccountCard } from "./AccountCard";

export default function SessionCard({ onLogout }: { onLogout: () => void }) {
  return (
    <AccountCard title="Session" danger>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-subtle">Log out of this device.</p>
        <Button size="lg" icon={<SignOutIcon size={16} />} onClick={onLogout}>Log out</Button>
      </div>

      {/* No account deletion API yet */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-red-900/40 pt-4">
        <p className="text-xs text-subtle">Permanently delete your account. <span className="text-zinc-600">Coming soon.</span></p>
        <Button size="lg" variant="danger" icon={<TrashIcon size={16} />} disabled title="Account deletion isn't supported yet">
          Delete account
        </Button>
      </div>
    </AccountCard>
  );
}
