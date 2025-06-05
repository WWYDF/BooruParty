'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import clsx from "clsx";

type NavItemProps = {
  href: string;
  icon?: ReactNode;
  children: ReactNode;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
};

export function NavItem({ href, icon, children, onClick, className }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname.includes(href);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={clsx(
        "flex items-center gap-2 transition hover:text-white",
        isActive ? "text-accent" : "text-subtle",
        className // ✅ Apply custom className last so it can override
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
