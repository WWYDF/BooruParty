"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const sections = ["", "edit", "merge", "delete"];

const normalizePath = (path: string) => path.replace(/\/+$/, ''); // Remove trailing slashes

export default function TagSubNavbar({ tag }: { tag: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-4 text-subtle border-b border-secondary-border pb-2 mb-4">
      {sections.map((section) => {
        const href = section === "" 
          ? `/dashboard/tags/${tag}` 
          : `/dashboard/tags/${tag}/${section}`;
        const label = section === "" ? "Summary" : section[0].toUpperCase() + section.slice(1);
        
        // Normalize both paths before comparison
        const normalizedHref = normalizePath(href);
        const normalizedPathname = normalizePath(pathname);
        const isActive = normalizedPathname === normalizedHref;

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
