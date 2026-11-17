"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useUser } from "@/components/UserProvider";

// section "" = the summary page. perm = what the API requires for that action
const SECTIONS: { section: string; label: string; perm?: string }[] = [
  { section: "", label: "Summary" },
  { section: "edit", label: "Edit", perm: "tags.edit" },
  { section: "merge", label: "Merge", perm: "tags.delete" },  // merging removes the source tag
  { section: "delete", label: "Delete", perm: "tags.delete" },
];

const normalizePath = (path: string) => path.replace(/\/+$/, ''); // Remove trailing slashes

export default function TagSubNavbar({ tag }: { tag: string }) {
  const pathname = usePathname();
  const { user } = useUser();

  const visible = SECTIONS.filter(({ perm }) => !perm || user?.permissions.includes(perm));
  if (visible.length <= 1) return null; // just "Summary": no point showing a nav

  return (
    <nav className="flex gap-4 text-subtle border-b border-secondary-border pb-2 mb-4">
      {visible.map(({ section, label }) => {
        const href = section === "" ? `/tags/${tag}` : `/tags/${tag}/${section}`;
        const isActive = normalizePath(pathname) === normalizePath(href);

        return (
          <Link
            key={section}
            href={href}
            className={clsx(
              "text-sm hover:text-accent transition-colors",
              isActive && "text-accent font-semibold"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
