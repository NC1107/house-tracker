import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import InfoTip from "@/components/InfoTip";

export type BuyerDirection = "lower" | "higher" | "context";

/**
 * A chart wrapped with a title, source, a one-line "what it's for" explanation, and (the
 * important part for buyers) a badge stating which direction is good for them.
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
        <span className="flex items-center gap-2">
          <InfoTip text={whatFor} label={`About: ${title}`} />
          <h2 className="font-semibold">{title}</h2>
        </span>
        {source && <span className="shrink-0 text-xs text-[var(--muted)]">{source}</span>}
      </div>
      {badge && <div className="mb-3">{badge}</div>}
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
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: "color-mix(in srgb, var(--good) 14%, transparent)", color: "var(--good-ink)" }}
      title="For buyers"
    >
      {text}
    </span>
  );
}
