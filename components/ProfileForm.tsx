"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PROFILE_COOKIE } from "@/lib/profile-shared";
import { usd } from "@/lib/format";

export default function ProfileForm({
  income,
  downPct,
  monthlyDebts,
  isCustom,
}: {
  income: number;
  downPct: number;
  monthlyDebts: number;
  isCustom: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [inc, setInc] = useState(income);
  const [dp, setDp] = useState(Math.round(downPct * 100));
  const [debts, setDebts] = useState(monthlyDebts);
  const [saving, setSaving] = useState(false);

  function save() {
    setSaving(true);
    const payload = encodeURIComponent(JSON.stringify({ income: inc, downPct: dp / 100, monthlyDebts: debts }));
    document.cookie = `${PROFILE_COOKIE}=${payload};path=/;max-age=31536000;samesite=lax`;
    router.refresh();
    setTimeout(() => { setSaving(false); setOpen(false); }, 400);
  }

  function reset() {
    document.cookie = `${PROFILE_COOKIE}=;path=/;max-age=0`;
    router.refresh();
    setOpen(false);
  }

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="font-semibold">{isCustom ? "Your numbers" : "Using US averages"}</span>
          <span className="ml-2 text-[var(--text-2)]">
            {usd(inc)}/yr · {dp}% down{debts > 0 ? ` · ${usd(debts)}/mo debts` : ""}
          </span>
        </div>
        <div className="flex gap-2">
          {isCustom && (
            <button onClick={reset} className="rounded-lg px-3 py-1.5 text-sm text-[var(--text-2)] hover:bg-[var(--surface-2)]">
              Reset to averages
            </button>
          )}
          <button onClick={() => setOpen((o) => !o)} className="btn">
            {open ? "Close" : isCustom ? "Edit" : "Use my numbers"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="label">Household income /yr</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">$</span>
              <input type="number" min={0} step={5000} className="input pl-7" value={inc} onChange={(e) => setInc(Number(e.target.value) || 0)} />
            </div>
          </label>
          <label className="block">
            <span className="label">Down payment</span>
            <div className="relative">
              <input type="number" min={0} max={100} step={1} className="input pr-8" value={dp} onChange={(e) => setDp(Number(e.target.value) || 0)} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">%</span>
            </div>
          </label>
          <label className="block">
            <span className="label">Other monthly debts</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">$</span>
              <input type="number" min={0} step={50} className="input pl-7" value={debts} onChange={(e) => setDebts(Number(e.target.value) || 0)} />
            </div>
          </label>
          <div className="sm:col-span-3">
            <button onClick={save} disabled={saving} className="btn">
              {saving ? "Saving…" : "Save & personalize"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
