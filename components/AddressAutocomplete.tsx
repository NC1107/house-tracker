"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useDismissable } from "@/lib/useDismissable";
import type { AddressSuggestion } from "@/lib/geo/suggest";

/**
 * Debounced type-ahead for US addresses, backed by /api/geocode/suggest.
 * Picking a suggestion hands its coordinates to `onSelect`, so the caller can
 * skip geocoding entirely. Typing after a pick invalidates the coordinates
 * (the parent clears them in `onChange`). Degrades to a plain text input when
 * the suggestion service is unavailable.
 */
export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  name,
  placeholder,
}: {
  value: string;
  onChange: (text: string) => void;
  onSelect: (s: AddressSuggestion) => void;
  name?: string;
  placeholder?: string;
}) {
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const { open, setOpen } = useDismissable(boxRef);
  const [items, setItems] = useState<AddressSuggestion[]>([]);
  const [active, setActive] = useState(-1);
  // Selecting writes the label back into `value`; that change must not refetch.
  const skipFetchRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (skipFetchRef.current) {
      skipFetchRef.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setItems([]);
      setOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(`/api/geocode/suggest?q=${encodeURIComponent(q)}`, { signal: ac.signal });
        const data = (await res.json()) as { suggestions?: AddressSuggestion[] };
        if (ac.signal.aborted) return;
        const next = Array.isArray(data.suggestions) ? data.suggestions : [];
        setItems(next);
        setActive(-1);
        setOpen(next.length > 0);
      } catch {
        // Aborted by newer input, or the service is down: stay a plain input.
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function pick(s: AddressSuggestion) {
    skipFetchRef.current = true;
    onSelect(s);
    setItems([]);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(items[active >= 0 ? active : 0]);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        type="text"
        className="input"
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => items.length > 0 && setOpen(true)}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
      />
      {open && items.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg"
        >
          {items.map((s, i) => (
            <li key={s.label} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onClick={() => pick(s)}
                onMouseEnter={() => setActive(i)}
                className={`block w-full truncate rounded-lg px-2 py-1.5 text-left text-sm ${
                  i === active ? "bg-[var(--surface-2)] text-[var(--text-1)]" : "text-[var(--text-2)]"
                }`}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
