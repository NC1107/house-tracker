"use client";

import { useMemo, useState } from "react";
import { costOfWaiting } from "@/lib/costofwaiting";
import { usd } from "@/lib/format";
import NumberField from "@/components/NumberField";

export default function CostOfWaiting({ defaultRate = 6.8, defaultPrice = 415_000 }: { defaultRate?: number; defaultPrice?: number }) {
  const [price, setPrice] = useState(defaultPrice);
  const [downPct, setDownPct] = useState(20);
  const [rate, setRate] = useState(defaultRate);
  const [priceChange, setPriceChange] = useState(4);
  const [rateChange, setRateChange] = useState(0.5);
  const [wait, setWait] = useState(12);

  const r = useMemo(
    () =>
      costOfWaiting({
        homePrice: price,
        downPct: downPct / 100,
        currentRate: rate,
        annualPriceChangePct: priceChange / 100,
        rateChangePts: rateChange,
        waitMonths: wait,
      }),
    [price, downPct, rate, priceChange, rateChange, wait],
  );

  const worse = r.waitingCostsMore;
  const headline = worse
    ? `Waiting ${wait} months costs you more`
    : `Waiting ${wait} months could save you money`;
  const headlineColor = worse ? "var(--critical)" : "var(--good)";

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <div className="card space-y-4">
        <h2 className="text-lg font-semibold">If you wait…</h2>
        <p className="-mt-2 text-xs text-[var(--muted)]">Prefilled with average US values — edit to match your situation.</p>
        <Field label="Home price today"><Num v={price} set={setPrice} prefix="$" step={10000} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Down payment"><Num v={downPct} set={setDownPct} suffix="%" step={1} /></Field>
          <Field label="Rate today"><Num v={rate} set={setRate} suffix="%" step={0.125} /></Field>
        </div>
        <Field label={`Wait: ${wait} months`}>
          <input type="range" min={3} max={36} step={3} value={wait} onChange={(e) => setWait(+e.target.value)} className="w-full accent-[var(--brand)]" />
        </Field>
        <Field label={`Prices change ${priceChange > 0 ? "+" : ""}${priceChange}% / yr`}>
          <input type="range" min={-10} max={12} step={1} value={priceChange} onChange={(e) => setPriceChange(+e.target.value)} className="w-full accent-[var(--brand)]" />
        </Field>
        <Field label={`Rate changes ${rateChange > 0 ? "+" : ""}${rateChange} pts`}>
          <input type="range" min={-2} max={2} step={0.25} value={rateChange} onChange={(e) => setRateChange(+e.target.value)} className="w-full accent-[var(--brand)]" />
        </Field>
        <p className="text-xs text-[var(--muted)]">
          Compares buying today vs. after the wait, assuming prices compound and the rate shifts.
        </p>
      </div>

      <div className="space-y-6">
        <div className="card">
          <p className="text-3xl font-bold" style={{ color: headlineColor }}>{headline}</p>
          <p className="mt-2 text-sm text-[var(--text-2)]">
            The same home would cost <strong className="text-[var(--text-1)]">{usd(r.laterPrice)}</strong> at{" "}
            <strong className="text-[var(--text-1)]">{(rate + rateChange).toFixed(2)}%</strong> in {wait} months.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Delta label="Monthly payment" now={r.nowPayment} later={r.laterPayment} delta={r.monthlyDelta} suffix="/mo" />
          <Delta label="Cash for down payment" now={r.nowDownPayment} later={r.laterDownPayment} delta={r.downPaymentDelta} />
          <Delta label="Lifetime interest" now={null} later={null} delta={r.lifetimeInterestDelta} />
        </div>
      </div>
    </div>
  );
}

function Delta({ label, now, later, delta, suffix = "" }: { label: string; now: number | null; later: number | null; delta: number; suffix?: string }) {
  const bad = delta > 0;
  return (
    <div className="card">
      <p className="text-sm text-[var(--text-2)]">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: bad ? "var(--critical)" : "var(--good)" }}>
        {delta > 0 ? "+" : delta < 0 ? "−" : ""}
        {usd(Math.abs(delta))}
        {suffix}
      </p>
      {now !== null && later !== null && (
        <p className="mt-0.5 text-xs text-[var(--muted)] tabular-nums">
          {usd(now)}{suffix} → {usd(later)}{suffix}
        </p>
      )}
      <p className="mt-0.5 text-xs text-[var(--muted)]">{bad ? "more if you wait" : delta < 0 ? "less if you wait" : "no change"}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function Num({ v, set, prefix, suffix, step = 1 }: { v: number; set: (n: number) => void; prefix?: string; suffix?: string; step?: number }) {
  return <NumberField value={v} onChange={set} prefix={prefix} suffix={suffix} step={step} />;
}
