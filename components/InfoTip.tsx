"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A circled-i that opens a small popover with explanatory text. Used to keep chart
 * descriptions available without cluttering the card. Pure CSS glyph, no emoji.
 */
export default function InfoTip({ text, label = "About this chart" }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={label}
        className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-current text-[10px] font-semibold leading-none text-[var(--muted)] hover:text-[var(--text-1)]"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-40 mt-1.5 block w-72 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left shadow-lg"
        >
          <span className="block text-xs font-normal leading-relaxed text-[var(--text-1)]">{text}</span>
        </span>
      )}
    </span>
  );
}
