import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import InfoTip from "@/components/InfoTip";
import { formatMetric } from "@/lib/format";
import type { ValueFormat } from "@/lib/types";

export type BuyerDirection = "lower" | "higher" | "context";

/**
 * A chart wrapped in a one-row header:
 *
 *   (i) Title                              [latest value]
 *   [time-range buttons]  <- rendered by the chart itself
 *   chart
 *
 * The chip shows the series' latest value, tinted by which side of the chart's
 * benchmark it sits on (given the buyer-friendly direction); with no benchmark
 * it stays neutral. The full explanation, formula, source, and the direction
 * note live in the (i) popover.
 */
export function ChartCard({
  title,
  source,
  formula,
  whatFor,
  direction,
  latest,
  benchmark,
  format = "number",
  children,
}: {
  title: string;
  /** Where the data comes from; shown inside the (i) popover. */
  source?: string;
  /** How the plotted number is computed; shown inside the (i) popover. */
  formula?: string;
  whatFor: string;
  /** Which way is good for buyers; tints the chip and adds a line to the popover. */
  direction: BuyerDirection;
  /** Latest value of the plotted series, shown as the header chip. */
  latest?: number | null;
  /** The chart's primary benchmark value; colors the chip by which side we're on. */
  benchmark?: number;
  format?: ValueFormat;
  children: ReactNode;
}) {
  const directionNote =
    direction === "context" ? null : `For buyers, ${direction} is generally better here.`;
  const tip = (
    <>
      {whatFor}
      {directionNote && <span className="mt-1.5 block">{directionNote}</span>}
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
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0"><InfoTip text={tip} label={`About: ${title}`} /></span>
          <h2 className="min-w-0 font-semibold leading-snug">{title}</h2>
        </span>
        {valueChip({ latest, benchmark, direction, format })}
      </div>
      {children}
    </Card>
  );
}

type ChipTone = "good" | "warning" | "critical" | "neutral";

const TONE_STYLE: Record<ChipTone, { color: string; bg: string }> = {
  good: { color: "var(--good-ink)", bg: "color-mix(in srgb, var(--good) 14%, transparent)" },
  warning: { color: "var(--warning)", bg: "color-mix(in srgb, var(--warning) 14%, transparent)" },
  critical: { color: "var(--critical)", bg: "color-mix(in srgb, var(--critical) 12%, transparent)" },
  neutral: { color: "var(--text-2)", bg: "var(--surface-2)" },
};

/** Latest-value chip, tinted by which side of the benchmark the value sits on. */
function valueChip({
  latest,
  benchmark,
  direction,
  format,
}: {
  latest?: number | null;
  benchmark?: number;
  direction: BuyerDirection;
  format: ValueFormat;
}) {
  if (latest == null || !Number.isFinite(latest)) return null;
  let tone: ChipTone = "neutral";
  let hint = "Latest value";
  if (benchmark !== undefined && direction !== "context") {
    const near = Math.abs(latest - benchmark) <= Math.abs(benchmark || 1) * 0.03;
    const goodSide = direction === "lower" ? latest <= benchmark : latest >= benchmark;
    tone = near ? "warning" : goodSide ? "good" : "critical";
    hint = `Latest value vs the ${formatMetric(benchmark, format)} benchmark (${direction} is better for buyers)`;
  }
  const s = TONE_STYLE[tone];
  return (
    <span
      className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums"
      style={{ backgroundColor: s.bg, color: s.color }}
      title={hint}
    >
      now {formatMetric(latest, format)}
    </span>
  );
}
