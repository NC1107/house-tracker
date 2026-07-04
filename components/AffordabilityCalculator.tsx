"use client";

import { useMemo, useState } from "react";
import {
  maxAffordablePrice,
  cashToClose,
  GUIDELINES,
  type DownPaymentMode,
} from "@/lib/affordability";
import { usd, pct } from "@/lib/format";
import { Term } from "@/components/Term";
import NumberInput from "@/components/NumberField";

type DpKind = "percent" | "amount";

export default function AffordabilityCalculator({
  defaultRate = 6.8,
  defaultIncome = 120_000,
  defaultDownPct = 20,
  defaultDebts = 400,
}: {
  defaultRate?: number;
  defaultIncome?: number;
  defaultDownPct?: number;
  defaultDebts?: number;
}) {
  const [income, setIncome] = useState(defaultIncome);
  const [debts, setDebts] = useState(defaultDebts);
  const [dpKind, setDpKind] = useState<DpKind>("percent");
  const [dpPercent, setDpPercent] = useState(defaultDownPct);
  const [dpAmount, setDpAmount] = useState(80_000);
  const [rate, setRate] = useState(defaultRate);
  const [termYears, setTermYears] = useState(30);
  const [taxRate, setTaxRate] = useState(1.1);
  const [insRate, setInsRate] = useState(0.5);
  const [hoa, setHoa] = useState(0);
  const [guidelineKey, setGuidelineKey] = useState("qm");

  const downPayment: DownPaymentMode =
    dpKind === "percent"
      ? { kind: "percent", percent: dpPercent / 100 }
      : { kind: "amount", amount: dpAmount };

  const guideline = GUIDELINES[guidelineKey];

  const result = useMemo(
    () =>
      maxAffordablePrice({
        grossAnnualIncome: income,
        monthlyDebts: debts,
        downPayment,
        annualRatePct: rate,
        termMonths: termYears * 12,
        propertyTaxRate: taxRate / 100,
        insuranceRate: insRate / 100,
        monthlyHoa: hoa,
        guideline,
      }),
    [income, debts, dpKind, dpPercent, dpAmount, rate, termYears, taxRate, insRate, hoa, guidelineKey],
  );

  // Rate-scenario sensitivity: how max price moves as rates shift.
  const scenarios = useMemo(
    () =>
      [-1, -0.5, 0, 0.5, 1].map((delta) => {
        const r = Math.max(0.01, rate + delta);
        const res = maxAffordablePrice({
          grossAnnualIncome: income,
          monthlyDebts: debts,
          downPayment,
          annualRatePct: r,
          termMonths: termYears * 12,
          propertyTaxRate: taxRate / 100,
          insuranceRate: insRate / 100,
          monthlyHoa: hoa,
          guideline,
        });
        return { delta, rate: r, price: res.maxHomePrice, piti: res.piti.total };
      }),
    [income, debts, dpKind, dpPercent, dpAmount, rate, termYears, taxRate, insRate, hoa, guidelineKey],
  );

  const p = result.piti;
  const cash = cashToClose({ homePrice: result.maxHomePrice, downPayment: result.downPayment, monthlyPiti: p.total });

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      {/* Inputs */}
      <div className="card space-y-4">
        <h2 className="text-lg font-semibold">Your numbers</h2>
        <p className="-mt-2 text-xs text-[var(--muted)]">Prefilled with average US values. Edit to match your situation.</p>

        <Field label="Gross annual income">
          <NumberInput value={income} onChange={setIncome} prefix="$" step={5000} />
        </Field>

        <Field label="Other monthly debt payments (cars, cards, loans)">
          <NumberInput value={debts} onChange={setDebts} prefix="$" step={50} />
        </Field>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="label mb-0">Down payment</span>
            <div className="flex rounded-lg border border-[var(--border)] text-xs">
              {(["percent", "amount"] as DpKind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setDpKind(k)}
                  className={`px-2 py-1 ${dpKind === k ? "bg-[var(--brand)] text-white" : "text-[var(--text-2)]"}`}
                >
                  {k === "percent" ? "%" : "$"}
                </button>
              ))}
            </div>
          </div>
          {dpKind === "percent" ? (
            <NumberInput value={dpPercent} onChange={setDpPercent} suffix="%" step={1} />
          ) : (
            <NumberInput value={dpAmount} onChange={setDpAmount} prefix="$" step={5000} />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Interest rate">
            <NumberInput value={rate} onChange={setRate} suffix="%" step={0.125} />
          </Field>
          <Field label="Term">
            <select className="input" value={termYears} onChange={(e) => setTermYears(+e.target.value)}>
              <option value={30}>30 years</option>
              <option value={15}>15 years</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Property tax rate">
            <NumberInput value={taxRate} onChange={setTaxRate} suffix="%" step={0.1} />
          </Field>
          <Field label="Insurance rate">
            <NumberInput value={insRate} onChange={setInsRate} suffix="%" step={0.1} />
          </Field>
        </div>

        <Field label="Monthly HOA">
          <NumberInput value={hoa} onChange={setHoa} prefix="$" step={25} />
        </Field>

        <Field label="Underwriting guideline">
          <select className="input" value={guidelineKey} onChange={(e) => setGuidelineKey(e.target.value)}>
            {Object.values(GUIDELINES).map((g) => (
              <option key={g.key} value={g.key}>
                {g.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--muted)]">{guideline.source}</p>
        </Field>
      </div>

      {/* Results */}
      <div className="space-y-6">
        <div className="card">
          <p className="text-sm text-[var(--text-2)]">You can likely afford a home up to</p>
          <p className="mt-1 text-4xl font-bold text-[var(--brand)]">
            {usd(result.maxHomePrice)}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[var(--text-2)]">
            <span>Down payment: {usd(result.downPayment)}</span>
            <span>Loan: {usd(p.loanAmount)}</span>
            <span>LTV: {pct(p.ltv)}</span>
            {result.isJumbo && (
              <span className="font-medium text-[var(--warning)]">Jumbo loan (above conforming limit)</span>
            )}
          </div>
          <div className="mt-3 rounded-lg bg-[var(--surface-2)] p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">Cash to buy</span>
              <span className="font-semibold tabular-nums">{usd(cash.total)}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[var(--muted)]">
              <span>Down {usd(cash.downPayment)}</span>
              <span>+ closing ~{usd(cash.closingCosts)} (3%)</span>
              <span>+ reserves ~{usd(cash.reserves)} (2mo)</span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="card">
            <h3 className="mb-3 font-semibold">Monthly payment (<Term term="PITI" />)</h3>
            <Row label="Principal & interest" value={usd(p.principalAndInterest)} />
            <Row label="Property tax" value={usd(p.propertyTax)} />
            <Row label="Homeowners insurance" value={usd(p.insurance)} />
            {p.mortgageInsurance > 0 && (
              <Row label={guideline.mortgageInsurance === "mip" ? "FHA MIP" : "PMI"} value={usd(p.mortgageInsurance)} />
            )}
            {p.hoa > 0 && <Row label="HOA" value={usd(p.hoa)} />}
            <div className="mt-2 border-t border-[var(--border)] pt-2">
              <Row label="Total / month" value={usd(p.total)} bold />
            </div>
          </div>

          <div className="card">
            <h3 className="mb-3 font-semibold">Qualification</h3>
            <Row
              label={`Front-end DTI${guideline.frontEndLimit ? ` (max ${pct(guideline.frontEndLimit, 0)})` : ""}`}
              value={guideline.frontEndLimit ? pct(result.dti.frontEnd) : "n/a"}
            />
            <Row
              label={`Back-end DTI (max ${pct(guideline.backEndLimit, 0)})`}
              value={pct(result.dti.backEnd)}
            />
            <p className="mt-3 text-xs text-[var(--muted)]">
              The max price is the point where your binding ratio hits its limit. Lower your
              debts or raise your down payment to push it higher.
            </p>
          </div>
        </div>

        <div className="card">
          <h3 className="mb-3 font-semibold">Rate sensitivity</h3>
          <p className="mb-3 text-xs text-[var(--muted)]">
            What a rate change does to your buying power, the buyer&apos;s edge when timing a purchase.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--muted)]">
                  <th className="py-1 pr-4 font-medium">Rate</th>
                  <th className="py-1 pr-4 font-medium">Max price</th>
                  <th className="py-1 font-medium">Monthly PITI</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s) => (
                  <tr
                    key={s.delta}
                    className={s.delta === 0 ? "font-semibold text-[var(--brand)]" : ""}
                  >
                    <td className="py-1 pr-4">{s.rate.toFixed(3)}%</td>
                    <td className="py-1 pr-4">{usd(s.price)}</td>
                    <td className="py-1">{usd(s.piti)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
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

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-0.5 ${bold ? "text-base font-semibold" : "text-sm"}`}>
      <span className="text-[var(--text-2)]">{label}</span>
      <span>{value}</span>
    </div>
  );
}
