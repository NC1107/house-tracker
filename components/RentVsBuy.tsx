"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import { rentVsBuy } from "@/lib/rentvsbuy";
import { usd } from "@/lib/format";
import { CHART } from "@/lib/chartTheme";

export default function RentVsBuy({ defaultRate = 6.8, defaultRent = 2_200 }: { defaultRate?: number; defaultRent?: number }) {
  const [homePrice, setHomePrice] = useState(400_000);
  const [downPct, setDownPct] = useState(20);
  const [rate, setRate] = useState(defaultRate);
  const [rent, setRent] = useState(defaultRent);
  const [rentGrowth, setRentGrowth] = useState(3);
  const [appreciation, setAppreciation] = useState(3);
  const [investReturn, setInvestReturn] = useState(5);
  const [horizon, setHorizon] = useState(15);

  const result = useMemo(
    () =>
      rentVsBuy({
        homePrice,
        downPayment: homePrice * (downPct / 100),
        annualRatePct: rate,
        monthlyRent: rent,
        annualRentGrowth: rentGrowth / 100,
        annualHomeAppreciation: appreciation / 100,
        annualInvestmentReturn: investReturn / 100,
        horizonYears: horizon,
      }),
    [homePrice, downPct, rate, rent, rentGrowth, appreciation, investReturn, horizon],
  );

  const chartData = useMemo(
    () =>
      result.series
        .filter((_, i) => i % 3 === 0 || i === result.series.length - 1) // thin to quarterly
        .map((p) => ({
          year: +(p.month / 12).toFixed(2),
          Buy: Math.round(p.buyerNetWorth),
          Rent: Math.round(p.renterNetWorth),
        })),
    [result],
  );

  const be = result.breakevenMonth;
  const beYears = be ? Math.floor(be / 12) : null;
  const beMonths = be ? be % 12 : null;

  const rec =
    result.recommendation === "buy"
      ? { text: "Buying comes out ahead", cls: "text-emerald-600" }
      : result.recommendation === "rent"
        ? { text: "Renting comes out ahead", cls: "text-brand-600 dark:text-brand-500" }
        : { text: "It's roughly a wash", cls: "text-slate-600 dark:text-slate-300" };

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <div className="card space-y-4">
        <h2 className="text-lg font-semibold">Assumptions</h2>
        <p className="-mt-2 text-xs text-[var(--muted)]">Prefilled with average US values — edit to match your situation.</p>
        <Field label="Home price"><Num v={homePrice} set={setHomePrice} prefix="$" step={10000} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Down payment"><Num v={downPct} set={setDownPct} suffix="%" step={1} /></Field>
          <Field label="Mortgage rate"><Num v={rate} set={setRate} suffix="%" step={0.125} /></Field>
        </div>
        <Field label="Monthly rent (comparable place)"><Num v={rent} set={setRent} prefix="$" step={50} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rent growth / yr"><Num v={rentGrowth} set={setRentGrowth} suffix="%" step={0.5} /></Field>
          <Field label="Home appreciation / yr"><Num v={appreciation} set={setAppreciation} suffix="%" step={0.5} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Investment return / yr"><Num v={investReturn} set={setInvestReturn} suffix="%" step={0.5} /></Field>
          <Field label="Time in home (yrs)"><Num v={horizon} set={setHorizon} step={1} /></Field>
        </div>
        <p className="text-xs text-slate-400">
          Includes closing costs, maintenance, taxes, insurance, PMI, and the opportunity cost
          of your down payment. Net-worth method: whoever ends richer wins.
        </p>
      </div>

      <div className="space-y-6">
        <div className="card">
          <p className="text-sm text-slate-500">After {horizon} years</p>
          <p className={`mt-1 text-3xl font-bold ${rec.cls}`}>{rec.text}</p>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500">
            <span>Buy net worth: {usd(result.finalBuyerNetWorth)}</span>
            <span>Rent net worth: {usd(result.finalRenterNetWorth)}</span>
            <span>
              Breakeven:{" "}
              {be ? `${beYears}y ${beMonths}m` : `not within ${horizon} years`}
            </span>
          </div>
        </div>

        <div className="card">
          <h3 className="mb-3 font-semibold">Net worth over time: buy vs. rent</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} strokeOpacity={0.35} vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={{ stroke: CHART.grid }} tickFormatter={(y) => `${Math.round(y)}y`} minTickGap={32} />
              <YAxis tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => `$${v.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 })}`} />
              <Tooltip formatter={(v: number) => usd(v)} labelFormatter={(y) => `Year ${Math.round(Number(y))}`} contentStyle={{ fontSize: 12, borderRadius: 10 }} cursor={{ stroke: CHART.axis, strokeWidth: 1, strokeDasharray: "3 3" }} />
              <Legend />
              {be && <ReferenceLine x={+(be / 12).toFixed(2)} stroke={CHART.axis} strokeDasharray="4 4" label={{ value: "breakeven", fontSize: 11, fill: CHART.axis }} />}
              <Line type="monotone" dataKey="Buy" stroke={CHART.series1} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="Rent" stroke={CHART.series2} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function Num({ v, set, prefix, suffix, step = 1 }: { v: number; set: (n: number) => void; prefix?: string; suffix?: string; step?: number }) {
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{prefix}</span>}
      <input
        type="number"
        className={`input ${prefix ? "pl-7" : ""} ${suffix ? "pr-8" : ""}`}
        value={Number.isFinite(v) ? v : 0}
        step={step}
        onChange={(e) => set(e.target.value === "" ? 0 : Number(e.target.value))}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{suffix}</span>}
    </div>
  );
}
