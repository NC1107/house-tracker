"use client";

/**
 * Two-or-more-way pill toggle used for mode switches (US avg | Me, lender | budget).
 * One styling source instead of per-page copies of the same button classes.
 */
export default function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; ariaLabel?: string }[];
  ariaLabel: string;
}) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          aria-label={o.ariaLabel}
          className={`rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors ${
            value === o.value ? "bg-[var(--brand)] text-white" : "text-[var(--text-2)] hover:text-[var(--text-1)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
