"use client";

import { useEffect, useState } from "react";

/**
 * A number input backed by a string buffer so typing is natural: no forced leading zero
 * (the old `value={n || 0}` pattern turned "90000" into "090000"), and the field can be
 * empty mid-edit. We keep it a text input with inputMode="decimal" to sidestep browser
 * number-input quirks, strip non-numeric chars, and normalize on blur.
 */
export default function NumberField({
  value,
  onChange,
  prefix,
  suffix,
  step = 1,
  min = 0,
  max,
}: {
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  const [text, setText] = useState(() => display(value));

  // Re-sync when value changes from outside (reset, prefill, unit toggle).
  useEffect(() => {
    if (parse(text) !== value) setText(display(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">{prefix}</span>
      )}
      <input
        type="text"
        inputMode="decimal"
        step={step}
        className={`input ${prefix ? "pl-7" : ""} ${suffix ? "pr-8" : ""}`}
        value={text}
        onChange={(e) => {
          let raw = e.target.value.replace(/[^0-9.]/g, "");
          // Collapse a leading zero so "090000" can never appear.
          if (/^0\d/.test(raw)) raw = raw.replace(/^0+/, "");
          setText(raw);
          const n = raw === "" || raw === "." ? 0 : Number(raw);
          if (Number.isFinite(n)) onChange(clamp(n, min, max));
        }}
        onBlur={() => setText(display(clamp(parse(text), min, max)))}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">{suffix}</span>
      )}
    </div>
  );
}

function display(n: number) {
  return Number.isFinite(n) ? String(n) : "";
}
function parse(t: string) {
  const n = t === "" || t === "." ? 0 : Number(t);
  return Number.isFinite(n) ? n : 0;
}
function clamp(n: number, min?: number, max?: number) {
  if (min != null && n < min) n = min;
  if (max != null && n > max) n = max;
  return n;
}
