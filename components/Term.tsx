"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Inline glossary: wraps a jargon term so clicking it opens a small popover with a
 * plain-English definition and, where it applies, the actual formula behind the number.
 */
type Entry = { def: string; formula?: string };

export const GLOSSARY: Record<string, Entry> = {
  PITI: {
    def: "Your full monthly housing payment: Principal, Interest, property Taxes, and Insurance (plus HOA/PMI if any).",
    formula: "payment = principal & interest + property tax + insurance (+ HOA/PMI)",
  },
  DTI: {
    def: "Debt-to-income ratio: your monthly debt payments as a share of gross income. Lenders cap this to decide how much you qualify for.",
    formula: "DTI = total monthly debt payments / gross monthly income",
  },
  LTV: {
    def: "Loan-to-value: the loan as a share of the home's price. Below 80% (20%+ down) avoids PMI.",
    formula: "LTV = loan amount / home price",
  },
  PMI: {
    def: "Private mortgage insurance: an added monthly cost when you put under 20% down on a conventional loan. It drops off once you reach ~20% equity.",
  },
  MIP: {
    def: "FHA mortgage insurance premium: like PMI but for FHA loans; at 3.5% down it lasts the life of the loan.",
  },
  "price-to-income": {
    def: "How many years of household income the home costs. Around 3-4x is historically normal; 5x+ means homes are expensive relative to earnings.",
    formula: "ratio = home price / annual household income",
  },
  "sale-to-list": {
    def: "Below 1.0 means homes are selling under asking, a sign buyers have leverage.",
    formula: "ratio = final sale price / asking price",
  },
  "months of supply": {
    def: "How long it would take to sell every listing at the current sales pace. About 6 months is balanced; higher favors buyers.",
    formula: "supply = active listings / homes sold per month",
  },
  "Months of supply": {
    def: "How long it would take to sell every listing at the current sales pace. About 6 months is balanced; higher favors buyers.",
    formula: "supply = active listings / homes sold per month",
  },
  "Sale-to-list ratio": {
    def: "Below 1.0 means homes are selling under asking; buyers have leverage.",
    formula: "ratio = final sale price / asking price",
  },
  "Days on market": {
    def: "How long a typical listing sits before going under contract. Longer means buyers have more time to negotiate.",
  },
  "Listings with price cuts": {
    def: "Share of active listings that have dropped their price, a sign sellers are competing for buyers.",
    formula: "share = listings with a price drop / active listings",
  },
  "housing cost burden": {
    def: "The share of your gross income that goes to the full housing payment. Under ~30% is considered comfortable.",
    formula: "burden = monthly housing payment / gross monthly income",
  },
  ZHVI: {
    def: "Zillow Home Value Index: the typical home value in an area over time.",
  },
  jumbo: {
    def: "A loan above the conforming limit (~$832,750 in 2026). It usually needs stronger credit and may carry a higher rate.",
  },
};

export function Term({ term, children }: { term: keyof typeof GLOSSARY | string; children?: React.ReactNode }) {
  const entry = GLOSSARY[term];
  const text = children ?? term;
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

  if (!entry) return <>{text}</>;
  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="cursor-pointer border-b border-dotted border-current text-left"
        title="Click for the definition"
      >
        {text}
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-40 mt-1.5 block w-64 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left shadow-lg"
        >
          <span className="block text-xs leading-relaxed text-[var(--text-1)]">{entry.def}</span>
          {entry.formula && (
            <span className="mt-2 block rounded-lg bg-[var(--surface-2)] px-2 py-1.5 font-mono text-[11px] leading-snug text-[var(--text-2)]">
              {entry.formula}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
