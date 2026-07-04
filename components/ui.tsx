import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-[var(--text-2)]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-semibold">{children}</h2>
      {hint && <span className="text-xs text-[var(--muted)]">{hint}</span>}
    </div>
  );
}

type Tone = "neutral" | "good" | "warning" | "critical";
const toneColor: Record<Tone, string> = {
  neutral: "var(--text-1)",
  good: "var(--good)",
  warning: "var(--warning)",
  critical: "var(--critical)",
};

export function Stat({
  label,
  value,
  sub,
  tone = "neutral",
  hint,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  hint?: string;
}) {
  return (
    <div className="card flex min-w-0 flex-col">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-sm leading-tight text-[var(--text-2)]">{label}</p>
        {hint && <span className="badge shrink-0">{hint}</span>}
      </div>
      <p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl lg:text-3xl" style={{ color: toneColor[tone] }}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

/** Horizontal meter with a marker at `value` (0..100) over a red-amber-green track. */
export function Meter({
  value,
  leftLabel,
  midLabel,
  rightLabel,
  target,
  targetLabel,
}: {
  value: number;
  leftLabel: string;
  midLabel: string;
  rightLabel: string;
  /** Optional goal marker (0..100), e.g. an alert's trigger score. */
  target?: number;
  targetLabel?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const targetPct = target === undefined ? undefined : Math.max(0, Math.min(100, target));
  return (
    <div>
      <div className="relative h-2.5 w-full rounded-full" style={{ background: "linear-gradient(90deg,#d03b3b,#f59e0b,#0ca30c)" }}>
        {targetPct !== undefined && (
          <div
            className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 bg-[var(--text-2)]"
            style={{ left: `calc(${targetPct}% - 1px)` }}
            title={targetLabel}
          />
        )}
        <div
          className="absolute top-1/2 h-4 w-1.5 -translate-y-1/2 rounded-full bg-[var(--text-1)] ring-2 ring-[var(--surface)]"
          style={{ left: `calc(${pct}% - 3px)` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-[var(--muted)]">
        <span>{leftLabel}</span>
        <span>{midLabel}</span>
        <span>{rightLabel}</span>
      </div>
      {targetPct !== undefined && targetLabel && (
        <p className="mt-1 text-[11px] text-[var(--muted)]">{targetLabel}</p>
      )}
    </div>
  );
}

export function Bar({ score, color }: { score: number; color: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-[var(--surface-2)]">
      <div className="h-2 rounded-full" style={{ width: `${Math.max(0, Math.min(100, score))}%`, backgroundColor: color }} />
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <div className="card text-sm text-[var(--text-2)]">{children}</div>;
}

/** "Data through {date}" freshness caption. Pass the latest period date of the surface. */
export function Freshness({ date, label = "Data through" }: { date?: string | null; label?: string }) {
  if (!date) return null;
  return (
    <p className="text-xs text-[var(--muted)]">
      {label} {date}
    </p>
  );
}
