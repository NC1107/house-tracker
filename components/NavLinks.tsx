"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Overview" },
  { href: "/trends", label: "Trends" },
  { href: "/explore", label: "Region Explorer" },
  { href: "/where", label: "Where to Buy" },
  { href: "/affordability", label: "Affordability" },
  { href: "/rent-vs-buy", label: "Rent vs. Buy" },
  { href: "/timing", label: "Cost of Waiting" },
  { href: "/market", label: "Market Heat" },
  { href: "/alerts", label: "Alerts" },
];

export default function NavLinks() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="-mx-4 flex flex-1 gap-1 overflow-x-auto px-4 text-sm sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {nav.map((n) => {
        const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-2 transition-colors ${
              active
                ? "bg-[var(--surface-2)] font-medium text-[var(--text-1)]"
                : "text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
