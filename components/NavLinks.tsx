"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Item = { href: string; label: string };
type Group = { label: string; items: Item[] };
type Entry = Item | Group;

const nav: Entry[] = [
  { href: "/", label: "Overview" },
  { href: "/trends", label: "Trends" },
  {
    label: "Explore",
    items: [
      { href: "/explore", label: "Region Explorer" },
      { href: "/where", label: "Where to Buy" },
      { href: "/market", label: "Market Heat" },
    ],
  },
  {
    label: "Calculators",
    items: [
      { href: "/affordability", label: "Affordability" },
      { href: "/rent-vs-buy", label: "Rent vs. Buy" },
      { href: "/timing", label: "Cost of Waiting" },
    ],
  },
  { href: "/alerts", label: "Alerts" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

const linkBase = "whitespace-nowrap rounded-lg px-3 py-2 transition-colors";
const activeCls = "bg-[var(--surface-2)] font-medium text-[var(--text-1)]";
const idleCls = "text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]";

export default function NavLinks() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="-mx-4 flex flex-1 items-center gap-1 overflow-x-auto px-4 text-sm sm:mx-0 sm:overflow-visible sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {nav.map((entry) =>
        "items" in entry ? (
          <NavGroup key={entry.label} group={entry} pathname={pathname} />
        ) : (
          <Link
            key={entry.href}
            href={entry.href}
            aria-current={isActive(pathname, entry.href) ? "page" : undefined}
            className={`${linkBase} ${isActive(pathname, entry.href) ? activeCls : idleCls}`}
          >
            {entry.label}
          </Link>
        ),
      )}
    </nav>
  );
}

function NavGroup({ group, pathname }: { group: Group; pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const groupActive = group.items.some((i) => isActive(pathname, i.href));

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Close after navigating.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`${linkBase} inline-flex items-center gap-1 ${groupActive ? activeCls : idleCls}`}
      >
        {group.label}
        <span aria-hidden className={`text-[0.6rem] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-30 mt-1 min-w-[11rem] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg"
        >
          {group.items.map((i) => {
            const active = isActive(pathname, i.href);
            return (
              <Link
                key={i.href}
                href={i.href}
                role="menuitem"
                aria-current={active ? "page" : undefined}
                className={`block rounded-lg px-3 py-2 ${active ? activeCls : idleCls}`}
              >
                {i.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
