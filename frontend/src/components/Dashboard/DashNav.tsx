'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useUser } from "@/components/UserProvider";

// Every dashboard section and the permission that unlocks it (administrator unlocks everything,
// since the API expands it into every permission)
export const DASHBOARD_SECTIONS = [
  { name: "Home", href: "/dashboard", perm: "dashboard.view" },
  { name: "Settings", href: "/dashboard/settings", perm: "dashboard.settings" },
  { name: "Categories", href: "/dashboard/categories", perm: "tags.categories.manage" },
  { name: "Roles", href: "/dashboard/roles", perm: "dashboard.roles" },
  { name: "Addons", href: "/dashboard/addons", perm: "dashboard.addons" },
  { name: "Audit Log", href: "/dashboard/logs", perm: "dashboard.audit.log" },
] as const;

export function useDashboardSections() {
  const { user } = useUser();
  return DASHBOARD_SECTIONS.filter((s) => user?.permissions.includes(s.perm));
}

export function DashNav() {
  const pathname = usePathname();
  const sections = useDashboardSections();

  // "/dashboard" only matches itself; other sections also match their sub pages (/dashboard/import/status)
  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));

  return (
    <nav className="mb-6 flex flex-wrap gap-x-6 gap-y-2 border-b border-secondary-border pb-3 text-sm">
      {sections.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className={clsx(
            "transition-colors hover:text-accent",
            isActive(s.href) ? "font-medium text-accent" : "text-subtle",
          )}
        >
          {s.name}
        </Link>
      ))}
    </nav>
  );
}
