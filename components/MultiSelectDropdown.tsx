"use client";

import { useRef, useState } from "react";
import { useDismissable } from "@/lib/useDismissable";

/**
 * A compact dropdown of checkboxes for form multi-selects (home type, listed-by).
 * The button shows a summary; selections submit as repeated `name` values via
 * hidden inputs, identical to a native checkbox group.
 */
export default function MultiSelectDropdown({
  name,
  options,
  defaultSelected = [],
  anyLabel = "Any",
}: {
  name: string;
  options: { value: string; label: string }[];
  defaultSelected?: string[];
  anyLabel?: string;
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const ref = useRef<HTMLDivElement>(null);
  const { open, setOpen } = useDismissable(ref);

  const summary =
    selected.length === 0
      ? anyLabel
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? anyLabel
        : `${options.find((o) => o.value === selected[0])?.label} +${selected.length - 1}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="input flex w-40 items-center justify-between gap-2 text-left"
      >
        <span className="truncate">{summary}</span>
        <span aria-hidden className={`text-[0.6rem] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {selected.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 min-w-[12rem] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-lg">
          {options.map((o) => (
            <label key={o.value} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--surface-2)]">
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={(e) =>
                  setSelected((prev) =>
                    e.target.checked ? [...prev, o.value] : prev.filter((x) => x !== o.value),
                  )
                }
                className="accent-[var(--brand)]"
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
