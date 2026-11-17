'use client';

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@/components/UserProvider";
import { DASHBOARD_SECTIONS, DashNav, useDashboardSections } from "./DashNav";

function Denied({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-2 text-3xl font-bold text-red-400">{title}</h1>
      <p className="max-w-md text-subtle">{children}</p>
    </div>
  );
}

// Client-side gate for the whole dashboard: the layout is a server component and can't read the session.
// (The API enforces every permission anyway; this just keeps people from landing on broken/empty pages.)
export default function DashboardGate({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const pathname = usePathname();
  const sections = useDashboardSections();

  if (user === undefined) return null; // session still loading

  if (!user) {
    return (
      <Denied title="Unauthorized">
        Please <a href="/auth/login" className="text-accent hover:underline">log in</a> to use the dashboard.
      </Denied>
    );
  }

  if (sections.length === 0) {
    return <Denied title="Access Denied">Your role doesn&apos;t have access to any part of the dashboard.</Denied>;
  }

  // The section this URL belongs to (longest matching href wins, so /dashboard/import beats /dashboard)
  const current = [...DASHBOARD_SECTIONS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`));
  const allowed = !current || user.permissions.includes(current.perm);

  return (
    <>
      <DashNav />
      <div className="flex-1">
        {allowed ? children : <Denied title="Access Denied">Your role can&apos;t open this section.</Denied>}
      </div>
    </>
  );
}
