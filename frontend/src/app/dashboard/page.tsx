'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowsClockwiseIcon,
  ClipboardTextIcon,
  DownloadSimpleIcon,
  GearSixIcon,
  HardDrivesIcon,
  ImagesIcon,
  PuzzlePieceIcon,
  ShieldCheckIcon,
  SwatchesIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { API } from "@/core/api";
import { formatCounts, formatRelativeTime } from "@/core/formats";
import { useDashboardSections } from "@/components/Dashboard/DashNav";

type Stats = { megaBytesUsed: number; postCount: number; updatedAt: string | null };

// Icon + one-liner for each section tile (the Home tile itself is skipped)
const SECTION_INFO: Record<string, { icon: React.ReactNode; blurb: string }> = {
  "/dashboard/settings": { icon: <GearSixIcon size={20} />, blurb: "Guest access, safety limits, featured post" },
  "/dashboard/categories": { icon: <SwatchesIcon size={20} />, blurb: "Tag categories, colors and order" },
  "/dashboard/roles": { icon: <UsersThreeIcon size={20} />, blurb: "Roles and their permissions" },
  "/dashboard/addons": { icon: <PuzzlePieceIcon size={20} />, blurb: "Autotagger, games and extras" },
  "/dashboard/logs": { icon: <ClipboardTextIcon size={20} />, blurb: "Who changed what, and when" },
  "/dashboard/import": { icon: <DownloadSimpleIcon size={20} />, blurb: "Bring posts over from another booru" },
};

function formatStorage(mb: number) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-secondary-border bg-zinc-900/40 p-4">
      <div className="flex items-center gap-2 text-xs text-subtle">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-2xl font-semibold text-zinc-100 tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const sections = useDashboardSections().filter((s) => s.href !== "/dashboard");
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    API("/api/system/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Overview */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-200">Overview</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard
            icon={<ImagesIcon size={14} />}
            label="Posts"
            value={stats ? formatCounts(stats.postCount) : "—"}
          />
          <StatCard
            icon={<HardDrivesIcon size={14} />}
            label="Storage used"
            value={stats ? formatStorage(stats.megaBytesUsed) : "—"}
            hint={stats?.updatedAt ? `Measured ${formatRelativeTime(stats.updatedAt)}` : "Measured periodically by the server"}
          />
        </div>
      </section>

      {/* Sections this role can open */}
      {sections.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-zinc-200">Manage</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="group flex items-start gap-3 rounded-xl border border-secondary-border bg-zinc-900/40 p-4 transition-colors hover:border-accent/30 hover:bg-zinc-900/80"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-subtle transition-colors group-hover:text-accent">
                  {SECTION_INFO[s.href]?.icon}
                </span>
                <span>
                  <span className="block text-sm font-medium text-zinc-200">{s.name}</span>
                  <span className="block text-xs text-subtle">{SECTION_INFO[s.href]?.blurb}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* The old widgets, until their APIs exist */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-200">Maintenance</h2>
        <div className="rounded-xl border border-dashed border-secondary-border px-5 py-4 text-sm text-subtle">
          <p className="mb-2 flex items-center gap-2 text-zinc-300">
            <ShieldCheckIcon size={16} /> Coming back with the new API:
          </p>
          <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            <li className="flex items-center gap-2"><ArrowsClockwiseIcon size={14} /> Updater</li>
            <li className="flex items-center gap-2"><HardDrivesIcon size={14} /> Database backups</li>
            <li className="flex items-center gap-2"><ShieldCheckIcon size={14} /> Integrity checks (incl. recounting post/tag counts)</li>
            <li className="flex items-center gap-2"><UsersThreeIcon size={14} /> Permission sync</li>
            <li className="flex items-center gap-2"><ImagesIcon size={14} /> Boost cooldown</li>
            <li className="flex items-center gap-2"><ClipboardTextIcon size={14} /> Analytics</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
