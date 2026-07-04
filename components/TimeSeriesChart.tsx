"use client";

import { useId } from "react";
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
export type ValueFormat = "usd" | "percent" | "index" | "number";

function axisFormatter(format: ValueFormat): (v: number) => string {
  switch (format) {
    case "usd":
      return (v) => (Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v.toFixed(0)}`);
    case "percent":
      return (v) => `${v.toFixed(1)}%`;
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
}: {
  data: SeriesPoint[];
  color?: string;
  format?: ValueFormat;
  height?: number;
}) {
  const gradId = useId().replace(/:/g, "");
  if (!data.length) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--muted)]" style={{ height }}>
        No data yet — run ingestion to populate this chart.
      </div>
    );
  }
  const yAxis = axisFormatter(format);
  const yTip = tooltipFormatter(format);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
  );
}
