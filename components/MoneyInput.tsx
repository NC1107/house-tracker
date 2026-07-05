"use client";

import { useState } from "react";

/**
 * A currency form field: shows comma-formatted text ("400,000") while submitting a clean
 * number under `name` via a hidden input. Being a text input also sidesteps the native
 * number-input step validation that used to reject defaults like 323,488 (not a multiple
 * of step=10000) with "please enter a valid value".
 */
export default function MoneyInput({
  name,
  defaultValue,
  placeholder,
  className = "input w-32",
}: {
  name: string;
  defaultValue?: number | "";
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(() =>
    defaultValue === "" || defaultValue === undefined || !Number.isFinite(defaultValue)
      ? ""
      : Math.round(defaultValue).toLocaleString("en-US"),
  );
  const raw = text.replace(/[^0-9]/g, "");

  return (
    <span className="relative inline-block">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">$</span>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, "");
          setText(digits === "" ? "" : Number(digits).toLocaleString("en-US"));
        }}
        className={`${className} pl-7`}
      />
      <input type="hidden" name={name} value={raw} />
    </span>
  );
}
