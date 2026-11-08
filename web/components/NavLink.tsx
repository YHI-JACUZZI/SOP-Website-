"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// A top-bar link that lights up orange while you're in its part of the site.
export default function NavLink({ href, match = [href], children }: { href: string; match?: string[]; children: React.ReactNode }) {
  const path = usePathname();
  const active = match.some((m) => (m === "/" ? path === "/" : path === m || path.startsWith(`${m}/`)));
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-md px-2.5 py-1 transition-colors ${
        active ? "bg-brand-rule font-semibold text-bar" : "text-[#d6d2ce] hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
