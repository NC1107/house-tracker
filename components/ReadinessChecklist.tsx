"use client";

import { useEffect, useState } from "react";

const ITEMS = [
  { id: "fund", label: "Emergency fund (3–6 months of expenses)", hint: "Kept separate from your down payment." },
  { id: "debts", label: "Monthly debts under control", hint: "Lower debts raise how much home you qualify for." },
  { id: "credit", label: "Checked your credit score", hint: "A higher score means a lower rate — aim for 700+." },
  { id: "down", label: "Down payment + closing costs saved", hint: "See “Cash to buy”: down + ~3% closing + a couple months reserves." },
  { id: "income", label: "Stable, documentable income (~2 yrs)", hint: "Lenders want a steady, provable history." },
  { id: "preapproval", label: "Mortgage pre-approval", hint: "Confirms your real budget and strengthens your offers." },
];

export default function ReadinessChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      setChecked(JSON.parse(localStorage.getItem("ht_ready") || "{}"));
    } catch {
      /* ignore */
    }
  }, []);

  function toggle(id: string) {
    setChecked((c) => {
      const next = { ...c, [id]: !c[id] };
      try {
        localStorage.setItem("ht_ready", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const done = ITEMS.filter((i) => checked[i.id]).length;

  return (
    <div className="card">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-semibold">Are we ready to buy?</h2>
        <span className="text-xs text-[var(--muted)]">{done}/{ITEMS.length} done</span>
      </div>
      <ul className="space-y-2">
        {ITEMS.map((i) => (
          <li key={i.id}>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={!!checked[i.id]}
                onChange={() => toggle(i.id)}
                className="mt-1 h-4 w-4 accent-[var(--brand)]"
              />
              <span>
                <span className={`text-sm ${checked[i.id] ? "text-[var(--muted)] line-through" : "text-[var(--text-1)]"}`}>
                  {i.label}
                </span>
                <span className="block text-xs text-[var(--muted)]">{i.hint}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
