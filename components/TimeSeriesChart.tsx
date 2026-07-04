"use client";

import { useId, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { SeriesPoint } from "@/lib/types";
import { CHART } from "@/lib/chartTheme";

/**
 * Value format for the Y axis / tooltip. Passed as a plain string (not a function) so this
 * client component can be rendered from a Server Component.
 */
export type ValueFormat = "usd" | "percent" | "percent2" | "index" | "number";

const RANGES: { key: string; days: number }[] = [
  { key: "1W", days: 7 },
  { key: "1M", days: 30 },
  { key: "3M", days: 90 },
  { key: "6M", days: 182 },
  { key: "1Y", days: 365 },
  { key: "5Y", days: 1826 },
  { key: "All", days: Infinity },
];

const DAY = 86_400_000;

function axisFormatter(format: ValueFormat): (v: number) => string {
  switch (format) {
    case "usd":
      return (v) => `$${v.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 })}`;
    case "percent":
      return (v) => `${v.toFixed(1)}%`;
    case "percent2":
      return (v) => `${v.toFixed(2)}%`;
    case "index":
      return (v) => v.toFixed(0);
    default:
      return (v) => v.toLocaleString("en-US");
  }
}

function tooltipFormatter(format: ValueFormat): (v: number) => string {
  switch (format) {
    case "usd":
      return (v) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    case "percent":
    case "percent2":
      return (v) => `${v.toFixed(2)}%`;
    case "index":
      return (v) => v.toFixed(1);
    default:
      return (v) => v.toLocaleString("en-US");
  }
}

export default function TimeSeriesChart({
  data,
  color = CHART.series1,
  format = "number",
  height = 240,
  ranges = true,
}: {
  data: SeriesPoint[];
  color?: string;
  format?: ValueFormat;
  height?: number;
  /** Show the time-range selector (default true). */
  ranges?: boolean;
}) {
  const gradId = useId().replace(/:/g, "");

  // Which range buttons have enough data to be meaningful for THIS series.
  const { available, lastMs } = useMemo(() => {
    if (data.length < 2) return { available: [] as typeof RANGES, lastMs: 0 };
    const last = new Date(data[data.length - 1].date).getTime();
    const span = last - new Date(data[0].date).getTime();
    const avail = RANGES.filter((r) => {
      if (r.days === Infinity) return true;
      if (r.days * DAY > span) return false;
      const cutoff = last - r.days * DAY;
      const count = data.reduce((n, p) => (new Date(p.date).getTime() >= cutoff ? n + 1 : n), 0);
      return count >= 2;
    });
    return { available: avail, lastMs: last };
  }, [data]);

  const [range, setRange] = useState("All");

  const shown = useMemo(() => {
    const r = RANGES.find((x) => x.key === range);
    if (!r || r.days === Infinity || !lastMs) return data;
    const cutoff = lastMs - r.days * DAY;
    return data.filter((p) => new Date(p.date).getTime() >= cutoff);
  }, [data, range, lastMs]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--muted)]" style={{ height }}>
        No data yet — run ingestion to populate this chart.
      </div>
    );
  }

  const yAxis = axisFormatter(format);
  const yTip = tooltipFormatter(format);
  const showControls = ranges && available.length > 1;

  return (
    <div>
      {showControls && (
        <div className="mb-2 flex flex-wrap justify-end gap-1">
          {available.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-md px-2 py-0.5 text-xs font-medium tabular-nums transition-colors ${
                range === r.key
                  ? "bg-[var(--brand)] text-white"
                  : "text-[var(--text-2)] hover:bg-[var(--surface-2)]"
              }`}
              aria-pressed={range === r.key}
            >
              {r.key}
            </button>
          ))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={shown} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} strokeOpacity={0.35} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: CHART.axis }}
            tickLine={false}
            axisLine={{ stroke: CHART.grid }}
            minTickGap={48}
            tickFormatter={(d: string) => d.slice(0, 7)}
          />
          <YAxis
            tick={{ fontSize: 11, fill: CHART.axis }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={yAxis}
            domain={["auto", "auto"]}
          />
          <Tooltip
            formatter={(v: number) => [yTip(v), ""]}
            labelFormatter={(d) => String(d)}
            contentStyle={{ fontSize: 12, borderRadius: 10 }}
            cursor={{ stroke: CHART.axis, strokeWidth: 1, strokeDasharray: "3 3" }}
          />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gradId})`} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
