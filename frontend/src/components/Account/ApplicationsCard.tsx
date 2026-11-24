'use client';

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowsClockwiseIcon, CopyIcon, KeyIcon, PlusIcon, TrashIcon, WarningIcon, XIcon } from "@phosphor-icons/react";
import Button from "@/components/UI/Button";
import ConfirmModal from "@/components/UI/Modals/ConfirmModal";
import { useToast } from "@/components/UI/Toast";
import { formatRelativeTime } from "@/core/formats";
import { AccountCard, inputClass } from "./AccountCard";
import { Docs } from "@/core/constants/docs";
import { useSend } from "@/core/api";

const MAX_APPLICATIONS = 10; // backend MAX_APPLICATIONS
const MAX_NAME = 32;

// GET /api/applications (secretHash and ownerId are never sent)
type Application = {
  clientId: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
};

// A secret is only ever shown once: right after creating or regenerating
type RevealedSecret = { clientId: string, name: string, secret: string };

// API keys for scripts and bots. They authenticate as you, with "Authorization: Basic base64(clientId:secret)".
export default function ApplicationsCard() {
  const send = useSend();
  const toast = useToast();

  const [apps, setApps] = useState<Application[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<RevealedSecret | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "delete" | "regenerate", app: Application } | null>(null);

  useEffect(() => {
    send<Application[]>("/api/applications", "GET").then((data) => {
      if (data) setApps(data);
      else setFailed(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied`, "success");
    } catch {
      toast("Could not copy. Select it and copy manually", "error");
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);

    const created = await send<Application & { secret: string }>("/api/applications", "POST", { name: trimmed });
    setCreating(false);
    if (!created) return;

    const { secret, ...app } = created;
    setApps((prev) => [...(prev ?? []), { ...app, lastUsedAt: null }]);
    setRevealed({ clientId: app.clientId, name: app.name, secret });
    setName("");
  };

  const runConfirmed = async () => {
    const action = confirm;
    setConfirm(null);
    if (!action) return;
    const { app } = action;

    if (action.kind === "delete") {
      const ok = await send(`/api/applications/${app.clientId}`, "DELETE");
      if (!ok) return;
      setApps((prev) => prev?.filter((a) => a.clientId !== app.clientId) ?? prev);
      if (revealed?.clientId === app.clientId) setRevealed(null);
      toast(`Deleted "${app.name}"`, "success");
    } else {
      const data = await send<{ clientId: string, secret: string }>(`/api/applications/${app.clientId}/secret`, "POST");
      if (!data) return;
      setRevealed({ clientId: app.clientId, name: app.name, secret: data.secret });
    }
  };

  const atLimit = (apps?.length ?? 0) >= MAX_APPLICATIONS;

  return (
    <AccountCard
      title="Applications"
      description="API keys for scripts and bots. They show up as you, and can perform actions on your behalf, so keep secrets private."
      badge={apps ? `${apps.length}/${MAX_APPLICATIONS}` : undefined}
    >
      {/* Freshly made secret: shown once, then gone */}
      <AnimatePresence initial={false}>
        {revealed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mb-4 rounded-lg border border-amber-600/40 bg-amber-500/10 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-medium text-amber-300">
                  <WarningIcon size={14} weight="bold" className="shrink-0" />
                  Secret for "{revealed.name}": copy it now, you won't see it again.
                </p>
                <button
                  type="button"
                  onClick={() => setRevealed(null)}
                  aria-label="Dismiss"
                  className="shrink-0 cursor-pointer rounded p-0.5 text-amber-300/70 transition-colors hover:bg-amber-500/20 hover:text-amber-200"
                >
                  <XIcon size={14} />
                </button>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 select-all break-all rounded-md bg-zinc-950 px-2 py-1.5 font-mono text-xs text-zinc-100">
                  {revealed.secret}
                </code>
                <Button size="sm" icon={<CopyIcon size={12} />} onClick={() => copy(revealed.secret, "Secret")}>
                  Copy
                </Button>
              </div>

              <p className="mt-2 text-xs text-subtle">
                Send it as <code className="text-zinc-300">Authorization: Basic base64(clientId:secret)</code>.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {failed ? (
        <p className="text-xs text-red-400">Could not load your applications.</p>
      ) : apps === null ? (
        <p className="animate-pulse text-xs text-subtle">Loading...</p>
      ) : apps.length === 0 ? (
        <p className="text-xs text-subtle">You don't have any applications yet.</p>
      ) : (
        <ul className="divide-y divide-secondary-border rounded-lg border border-secondary-border">
          {apps.map((app) => (
            <li key={app.clientId} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm text-zinc-200">
                  <KeyIcon size={14} className="shrink-0 text-zinc-500" />
                  <span className="truncate">{app.name}</span>
                </p>
                <button
                  type="button"
                  onClick={() => copy(app.clientId, "Client ID")}
                  title="Copy client ID"
                  className="mt-0.5 flex max-w-full cursor-pointer items-center gap-1 font-mono text-2xs text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  <span className="truncate">{app.clientId}</span>
                  <CopyIcon size={11} className="shrink-0" />
                </button>
                <p className="mt-0.5 text-2xs text-zinc-600">
                  Created {formatRelativeTime(app.createdAt)} ·{" "}
                  {app.lastUsedAt ? `last used ${formatRelativeTime(app.lastUsedAt)}` : "never used"}
                </p>
              </div>

              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  icon={<ArrowsClockwiseIcon size={12} />}
                  onClick={() => setConfirm({ kind: "regenerate", app })}
                  title="Make a new secret (the old one stops working)"
                >
                  New secret
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  icon={<TrashIcon size={12} />}
                  onClick={() => setConfirm({ kind: "delete", app })}
                  aria-label={`Delete ${app.name}`}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {apps !== null && !failed && (
        <form onSubmit={create} className="mt-4 flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={atLimit ? `You can have up to ${MAX_APPLICATIONS} applications` : "New application name"}
            maxLength={MAX_NAME}
            disabled={atLimit}
            className={inputClass}
          />
          <Button
            type="submit"
            size="lg"
            variant="primary"
            icon={<PlusIcon size={16} weight="bold" />}
            loading={creating}
            disabled={atLimit || !name.trim()}
          >
            Create
          </Button>
        </form>
      )}

      <p className="mt-3 text-xs text-zinc-600">
        Need help? Check out our{" "}
        <a
          href={Docs.Applications}
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer text-accent underline-offset-2 hover:underline"
        >
          documentation
        </a>
        .
      </p>

      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirmed}
        title={confirm?.kind === "delete" ? "Delete application?" : "Make a new secret?"}
        description={
          confirm?.kind === "delete"
            ? `"${confirm.app.name}" will stop working immediately.`
            : `Anything still using the old secret for "${confirm?.app.name}" will stop working.`
        }
        confirmText={confirm?.kind === "delete" ? "Delete" : "Regenerate"}
      />
    </AccountCard>
  );
}
