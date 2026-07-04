import type { ReactNode } from "react";
import { Card } from "@/components/ui";

export type BuyerDirection = "lower" | "higher" | "context";

/**
 * A chart wrapped with a title, source, a one-line "what it's for" explanation, and — the
 * important part for buyers — a badge stating which direction is good for them.
 */
export function ChartCard({
  title,
  source,
  whatFor,
  direction,
  directionNote,
  children,
}: {
  title: string;
  source?: string;
  whatFor: string;
  direction: BuyerDirection;
  /** Overrides the default badge text (use for complex/nuanced charts). */
  directionNote?: string;
  children: ReactNode;
}) {
  const badge = directionBadge(direction, directionNote);
  return (
    <Card>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {source && <span className="shrink-0 text-xs text-[var(--muted)]">{source}</span>}
      </div>
      <div className="mb-3">{badge}</div>
      {children}
      <p className="mt-2 text-xs text-[var(--muted)]">{whatFor}</p>
    </Card>
  );
}

function directionBadge(direction: BuyerDirection, note?: string) {
  if (direction === "context") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-0.5 text-xs text-[var(--text-2)]">
        <span aria-hidden>ℹ</span>
        {note ?? "Context — no single “good” direction"}
      </span>
    );
  }
  const arrow = direction === "lower" ? "↓" : "↑";
  const text = note ?? (direction === "lower" ? "Lower is better for buyers" : "Higher is better for buyers");
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: "color-mix(in srgb, var(--good) 14%, transparent)", color: "var(--good)" }}
    >
      <span aria-hidden className="text-sm leading-none">{arrow}</span>
      For buyers: {text}
    </span>
  );
}
