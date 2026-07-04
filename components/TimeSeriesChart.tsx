"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { SeriesPoint } from "@/lib/types";

/**
 * Value format for the Y axis / tooltip. Passed as a plain string (not a function) so this
 * client component can be rendered from a Server Component — React Server Components cannot
 * receive function props.
 */
export type ValueFormat = "usd" | "percent" | "index" | "number";

function axisFormatter(format: ValueFormat): (v: number) => string {
  switch (format) {
    case "usd":
      return (v) =>
        Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v.toFixed(0)}`;
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
      return (v) =>
        v.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        });
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
  color = "#2563eb",
  format = "number",
}: {
  data: SeriesPoint[];
  color?: string;
  format?: ValueFormat;
}) {
  if (!data.length) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-slate-400">
        No data yet — run ingestion to populate this chart.
      </div>
    );
  }
  const yAxis = axisFormatter(format);
  const yTip = tooltipFormatter(format);
  return (
    <ResponsiveContainer width="100%" height={224}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          minTickGap={48}
          tickFormatter={(d: string) => d.slice(0, 7)}
        />
        <YAxis tick={{ fontSize: 11 }} width={56} tickFormatter={yAxis} domain={["auto", "auto"]} />
        <Tooltip
          formatter={(v: number) => yTip(v)}
          labelFormatter={(d) => String(d)}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
