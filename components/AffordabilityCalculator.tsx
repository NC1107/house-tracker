"use client";

import { useMemo, useState } from "react";
import {
  maxAffordablePrice,
  maxPriceForPayment,
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
  const [mode, setMode] = useState<"dti" | "budget">("dti");
  const [income, setIncome] = useState(defaultIncome);
  const [debts, setDebts] = useState(defaultDebts);
  // Budget mode: cash-flow based, in take-home dollars.
  const [takeHome, setTakeHome] = useState(Math.round((defaultIncome * 0.75) / 12 / 50) * 50);
  const [spending, setSpending] = useState(3_500);
  const [cushion, setCushion] = useState(500);
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
  const housingBudget = Math.max(0, takeHome - spending - cushion);

  const dtiResult = useMemo(
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

  const budgetResult = useMemo(
    () =>
      maxPriceForPayment({
        monthlyBudget: housingBudget,
        downPayment,
        annualRatePct: rate,
        termMonths: termYears * 12,
        propertyTaxRate: taxRate / 100,
        insuranceRate: insRate / 100,
        monthlyHoa: hoa,
        guideline,
      }),
    [housingBudget, dpKind, dpPercent, dpAmount, rate, termYears, taxRate, insRate, hoa, guidelineKey],
  );

  const maxHomePrice = mode === "dti" ? dtiResult.maxHomePrice : budgetResult.maxHomePrice;
  const resultDown = mode === "dti" ? dtiResult.downPayment : budgetResult.downPayment;

  // Rate-scenario sensitivity: how max price moves as rates shift.
  const scenarios = useMemo(
    () =>
      [-1, -0.5, 0, 0.5, 1].map((delta) => {
        const r = Math.max(0.01, rate + delta);
        const shared = {
          downPayment,
          annualRatePct: r,
          termMonths: termYears * 12,
          propertyTaxRate: taxRate / 100,
          insuranceRate: insRate / 100,
          monthlyHoa: hoa,
          guideline,
        };
        const res =
          mode === "dti"
            ? maxAffordablePrice({ grossAnnualIncome: income, monthlyDebts: debts, ...shared })
            : maxPriceForPayment({ monthlyBudget: housingBudget, ...shared });
        return { delta, rate: r, price: res.maxHomePrice, piti: res.piti.total };
      }),
    [mode, income, debts, housingBudget, dpKind, dpPercent, dpAmount, rate, termYears, taxRate, insRate, hoa, guidelineKey],
  );

  const p = mode === "dti" ? dtiResult.piti : budgetResult.piti;
  const cash = cashToClose({ homePrice: maxHomePrice, downPayment: resultDown, monthlyPiti: p.total });

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      {/* Inputs */}
      <div className="card space-y-4">
        <h2 className="text-lg font-semibold">Your numbers</h2>
        <p className="-mt-2 text-xs text-[var(--muted)]">Prefilled with average US values. Edit to match your situation.</p>

        <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5 text-sm" role="group" aria-label="Affordability mode">
          <button
            type="button"
            onClick={() => setMode("dti")}
            aria-pressed={mode === "dti"}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              mode === "dti" ? "bg-[var(--brand)] text-white" : "text-[var(--text-2)] hover:text-[var(--text-1)]"
            }`}
          >
            What a lender allows
          </button>
          <button
            type="button"
            onClick={() => setMode("budget")}
            aria-pressed={mode === "budget"}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              mode === "budget" ? "bg-[var(--brand)] text-white" : "text-[var(--text-2)] hover:text-[var(--text-1)]"
            }`}
          >
            What my budget allows
          </button>
        </div>

        {mode === "dti" ? (
          <>
            <Field label="Gross annual income">
              <NumberInput value={income} onChange={setIncome} prefix="$" step={5000} />
            </Field>

            <Field
              label="Monthly debt payments"
              hint="Minimum required payments on loans, cards, and car notes only. NOT rent, groceries, or general spending; entering total spending here will wrongly zero out your result."
            >
              <NumberInput value={debts} onChange={setDebts} prefix="$" step={50} />
            </Field>
          </>
        ) : (
          <>
            <Field label="Monthly take-home pay" hint="What actually hits your bank account after taxes and deductions.">
              <NumberInput value={takeHome} onChange={setTakeHome} prefix="$" step={250} />
            </Field>
            <Field
              label="Monthly spending (everything except housing)"
              hint="Food, cars, insurance, subscriptions, fun; leave out your current rent or mortgage."
            >
              <NumberInput value={spending} onChange={setSpending} prefix="$" step={250} />
            </Field>
            <Field label="Monthly cushion to keep" hint="Savings margin you refuse to touch.">
              <NumberInput value={cushion} onChange={setCushion} prefix="$" step={100} />
            </Field>
            <p className="rounded-lg bg-[var(--surface-2)] p-2 text-xs text-[var(--text-2)]">
              Housing budget: <strong className="text-[var(--text-1)]">{usd(housingBudget)}/mo</strong>{" "}
              (take-home {usd(takeHome)} - spending {usd(spending)} - cushion {usd(cushion)})
            </p>
          </>
        )}

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
          <p className="text-sm text-[var(--text-2)]">
            {mode === "dti"
              ? "A lender would likely approve a home up to"
              : `Your budget (${usd(housingBudget)}/mo for housing) covers a home up to`}
          </p>
          <p className="mt-1 text-4xl font-bold text-[var(--brand)]">
            {usd(maxHomePrice)}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[var(--text-2)]">
            <span>Down payment: {usd(resultDown)}</span>
            <span>Loan: {usd(p.loanAmount)}</span>
            <span>LTV: {pct(p.ltv)}</span>
            {mode === "dti" && dtiResult.isJumbo && (
              <span className="font-medium text-[var(--warning)]">Jumbo loan (above conforming limit)</span>
            )}
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            {mode === "dti"
              ? `Based on debt-to-income limits, what underwriting checks. Your own budget may be stricter: see "What my budget allows" (${usd(budgetResult.maxHomePrice)} at your current budget inputs).`
              : `Based on your actual cash flow. A lender would separately need you to pass DTI checks (currently up to ${usd(dtiResult.maxHomePrice)} on the lender view); the lower of the two numbers is the safe one.`}
          </p>
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

          {mode === "dti" ? (
            <div className="card">
              <h3 className="mb-3 font-semibold">Qualification</h3>
              <Row
                label={`Front-end DTI${guideline.frontEndLimit ? ` (max ${pct(guideline.frontEndLimit, 0)})` : ""}`}
                value={guideline.frontEndLimit ? pct(dtiResult.dti.frontEnd) : "n/a"}
              />
              <Row
                label={`Back-end DTI (max ${pct(guideline.backEndLimit, 0)})`}
                value={pct(dtiResult.dti.backEnd)}
              />
              <p className="mt-3 text-xs text-[var(--muted)]">
                The max price is the point where your binding ratio hits its limit. Lower your
                debts or raise your down payment to push it higher.
              </p>
            </div>
          ) : (
            <div className="card">
              <h3 className="mb-3 font-semibold">Where the budget goes</h3>
              <Row label="Take-home pay" value={usd(takeHome)} />
              <Row label="Everyday spending" value={`-${usd(spending)}`} />
              <Row label="Cushion kept" value={`-${usd(cushion)}`} />
              <div className="mt-2 border-t border-[var(--border)] pt-2">
                <Row label="Available for housing" value={usd(housingBudget)} bold />
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">
                The max price is where the full payment (including taxes, insurance, and any
                PMI) uses this whole amount. Raise the cushion for a safer number.
              </p>
            </div>
          )}
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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <p className="mt-1 text-xs leading-snug text-[var(--muted)]">{hint}</p>}
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
