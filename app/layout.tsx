import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";

// Set the theme before paint to avoid a flash of the wrong mode.
const themeInit = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){}})();`;

export const metadata: Metadata = {
  title: "House Tracker",
  description: "Track US housing prices, mortgage rates, and what you can afford.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#2a78d6",
  width: "device-width",
  initialScale: 1,
};

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/85 backdrop-blur">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-6">
              <div className="flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 whitespace-nowrap font-bold tracking-tight">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--brand)] text-sm text-white">H</span>
                  House Tracker
                </Link>
                <ThemeToggle className="sm:hidden" />
              </div>
              <nav className="-mx-4 flex flex-1 gap-1 overflow-x-auto px-4 text-sm sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {nav.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="whitespace-nowrap rounded-lg px-3 py-1.5 text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
                  >
                    {n.label}
                  </Link>
                ))}
              </nav>
              <ThemeToggle className="hidden sm:inline-flex" />
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 overflow-x-hidden px-4 py-6 sm:py-8">{children}</main>

          <footer className="mx-auto w-full max-w-6xl px-4 py-8 text-xs text-[var(--muted)]">
            Data: Zillow Research, Redfin, Realtor.com, FRED, US Census, HUD. National
            reference figures are approximate and dated. Estimates are for planning only —
            not a lending decision.
          </footer>
        </div>
      </body>
    </html>
  );
}
