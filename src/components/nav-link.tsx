"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Onglet de navigation : le vert lime marque uniquement la page courante. */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="tab shrink-0 px-1 text-[11px] sm:px-2.5 sm:text-[12px]"
    >
      {children}
    </Link>
  );
}
