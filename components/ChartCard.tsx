import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import InfoTip from "@/components/InfoTip";

export type BuyerDirection = "lower" | "higher" | "context";

/**
 * A chart wrapped in a consistent header:
 *
 *   (i)                          [lower is better]
 *   Title
 *   [time-range buttons]  <- rendered by the chart itself
 *   chart
 *
 * The card face stays clean: the full explanation, the formula, and the data source all
 * live in the (i) popover; the badge states which direction is good for buyers.
 */
export function ChartCard({
  title,
  source,
  formula,
  whatFor,
  direction,
  directionNote,
  children,
}: {
  title: string;
  /** Where the data comes from; shown inside the (i) popover. */
  source?: string;
  /** How the plotted number is computed; shown inside the (i) popover. */
  formula?: string;
  whatFor: string;
  direction: BuyerDirection;
  /** Overrides the default badge text (use for complex/nuanced charts). */
  directionNote?: string;
  children: ReactNode;
}) {
  const badge = directionBadge(direction, directionNote);
  const tip = (
    <>
      {whatFor}
      {formula && (
        <span className="mt-2 block font-mono text-[11px] leading-snug text-[var(--text-2)]">
          {formula}
        </span>
      )}
      {source && (
        <span className="mt-1.5 block text-[var(--muted)]">Source: {source}</span>
      )}
    </>
  );
  return (
    <Card>
      {/* Top row: (i) pinned left, badge pinned right. Both no-shrink so neither can
          wrap under the other or clip at narrow widths. */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="shrink-0"><InfoTip text={tip} label={`About: ${title}`} /></span>
        {badge}
      </div>
      <h2 className="mb-2 font-semibold leading-snug">{title}</h2>
      {children}
    </Card>
  );
}

function directionBadge(direction: BuyerDirection, note?: string) {
  // "context" charts carry their nuance in the whatFor description instead of a badge.
  if (direction === "context") return null;
  const text = note ?? (direction === "lower" ? "Lower is better" : "Higher is better");
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: "color-mix(in srgb, var(--good) 14%, transparent)", color: "var(--good-ink)" }}
      title="For buyers"
    >
      {text}
    </span>
  );
}
