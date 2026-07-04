import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "House Tracker",
  description: "Track US housing prices, mortgage rates, and what you can afford.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

const nav = [
  { href: "/", label: "Overview" },
  { href: "/explore", label: "Region Explorer" },
  { href: "/affordability", label: "Affordability" },
  { href: "/rent-vs-buy", label: "Rent vs. Buy" },
  { href: "/market", label: "Market Heat" },
  { href: "/alerts", label: "Alerts" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <Link href="/" className="font-semibold">
                House Tracker
              </Link>
              <nav className="flex gap-1 text-sm">
                {nav.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    {n.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-slate-400">
            Data: Zillow Research, Redfin, Realtor.com, FRED, US Census, HUD. Estimates for
            planning only — not a lending decision.
          </footer>
        </div>
      </body>
    </html>
  );
}
