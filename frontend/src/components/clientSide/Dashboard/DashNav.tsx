'use client'
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { name: "Home", href: "/dashboard" },
  { name: "Tags", href: "/tags" },
  { name: "Categories", href: "/dashboard/categories" },
  { name: "Roles", href: "/dashboard/roles" },
  { name: "Audit Log", href: "/dashboard/logs" },
  { name: "Importer", href: "/dashboard/import" },
];

export function DashNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 border-b border-secondary-border pb-3 flex gap-6 text-sm">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`hover:text-accent transition ${
            pathname === link.href ? "text-accent font-medium" : "text-subtle"
          }`}
        >
          {link.name}
        </Link>
      ))}
    </nav>
  );
}
