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

export default function TimeSeriesChart({
  data,
  color = "#2563eb",
  yFormat = (v: number) => String(v),
}: {
  data: SeriesPoint[];
  color?: string;
  yFormat?: (v: number) => string;
}) {
  if (!data.length) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-slate-400">
        No data yet — run ingestion to populate this chart.
      </div>
    );
  }
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
        <YAxis tick={{ fontSize: 11 }} width={56} tickFormatter={yFormat} domain={["auto", "auto"]} />
        <Tooltip
          formatter={(v: number) => yFormat(v)}
          labelFormatter={(d) => String(d)}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
