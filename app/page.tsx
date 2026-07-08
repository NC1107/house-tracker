import Link from "next/link";
import TimeSeriesChart, { type RefLine } from "@/components/TimeSeriesChart";
import { PageHeader, Card, Stat, SectionTitle, Meter, EmptyNote } from "@/components/ui";
import { ChartCard } from "@/components/ChartCard";
import { PaymentToBuyCard, PriceToIncomeCard } from "@/components/SharedChartCards";
import { Term } from "@/components/Term";
import { latestMortgageRate, rateHistory, nationalSeries, listAlertRules, dbConfigured } from "@/lib/queries";
import { buyerSnapshot, NATIONAL } from "@/lib/reference";
import { breakevenRateForPrice } from "@/lib/affordability";
import { getProfile } from "@/lib/profile";
import { paymentToBuySeries, priceToIncomeSeries } from "@/lib/trends";
import { usd, pct } from "@/lib/format";
import { CHART } from "@/lib/chartTheme";

export const dynamic = "force-dynamic";

function years(n: number): string {
  const r = Math.max(1, Math.round(n));
  return `${r} ${r === 1 ? "yr" : "yrs"}`;
}

export default async function OverviewPage() {
  const [rate, rates, caseShiller, medianPrice, income, dailyRate] = await Promise.all([
    latestMortgageRate("30yr"),
    rateHistory("30yr"),
    nationalSeries("case_shiller_national"),
    nationalSeries("median_sale_price_us"),
    nationalSeries("nominal_median_income"),
    nationalSeries("mortgage_30yr_daily"),
  ]);

  // Prefer daily rate for chart granularity; fall back to the weekly PMMS series.
  const rateChart = dailyRate.length > 0 ? dailyRate : rates;

  const currentRate = rate?.rate ?? 6.8;
  const profile = await getProfile();
  const snap = buyerSnapshot(currentRate, profile);

  // Markers for the rate chart: alert triggers the user set, plus the personal breakeven
  // (the highest rate at which the typical home is still comfortably affordable).
  const alertRules = await listAlertRules();
  const rateLines: RefLine[] = alertRules
    .filter((r) => r.enabled && r.type === "rate_threshold" && Number.isFinite(Number(r.params.below)))
    .map((r) => ({
      value: Number(r.params.below),
      label: `Alert ${Number(r.params.below)}%`,
      color: CHART.warning,
    }));
  const breakevenRate = breakevenRateForPrice({
    homePrice: snap.medianHomePrice,
    grossAnnualIncome: snap.medianIncome,
    monthlyDebts: profile.monthlyDebts,
    downPayment: { kind: "percent", percent: profile.downPct },
  });
  // Only draw the breakeven when it's near the plotted range; a far-out value in either
  // direction (e.g. 1.3% or 12.7% when rates span 3-9%) would stretch the Y axis and
  // squash the actual data, and the hero sentence already states the number.
  const chartMin = rateChart.length ? Math.min(...rateChart.map((p) => p.value)) : null;
  const chartMax = rateChart.length ? Math.max(...rateChart.map((p) => p.value)) : null;
  const breakevenShown =
    breakevenRate !== null &&
    chartMin !== null &&
    chartMax !== null &&
    breakevenRate >= chartMin - 1 &&
    breakevenRate <= chartMax + 1;
  if (breakevenShown) {
    rateLines.push({
      value: breakevenRate,
      label: `Affordable ≤ ${breakevenRate.toFixed(1)}%`,
      color: CHART.good,
      labelPos: "right",
    });
  }

  const rateSource = dailyRate.length
    ? "Optimal Blue daily index (OBMMIC30YF) via FRED"
    : "Freddie Mac weekly survey (PMMS) via FRED";
  const rateWhatFor =
    "The average interest rate on a new 30-year fixed mortgage, the loan most US buyers use. It sets your monthly payment more than the sticker price does: roughly, each +1 point on the rate adds ~10% to the payment on the same house." +
    (rateLines.some((l) => l.color === CHART.warning)
      ? " The amber dashed line is a rate alert you set; you'll be notified when the rate reaches it."
      : "") +
    (breakevenShown
      ? " The green dashed line is your personal breakeven: the highest rate at which the typical US home still fits a comfortable budget (≤28% of income) on your profile."
      : "");

  // Derived buying-power trends (the "true cost" story buyers care about most).
  const paymentTrend = paymentToBuySeries(medianPrice, rates);
  const p2iTrend = priceToIncomeSeries(medianPrice, income);
  const latestIncome = income.at(-1)?.value ?? snap.medianIncome;

  const burdenTone = snap.housingBurden > 0.36 ? "critical" : snap.housingBurden > 0.3 ? "warning" : "good";
  const p2iTone = snap.priceToIncome > 5 ? "critical" : snap.priceToIncome > 4 ? "warning" : "good";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Can we afford a home?"
        subtitle="Prices, rates, and what they mean for buying. Set your numbers to make it about you."
      />

      {/* Hero: the household's buying power */}
      <Card className="bg-gradient-to-br from-[var(--surface)] to-[var(--surface-2)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="badge">{profile.isCustom ? "Your household" : "Median US household"}</span>
            <p className="mt-3 text-sm text-[var(--text-2)]">
              Earning <strong className="text-[var(--text-1)]">{usd(snap.medianIncome)}</strong>/yr, at today&apos;s{" "}
              <strong className="text-[var(--text-1)]">{currentRate.toFixed(2)}%</strong> rate, can comfortably afford
            </p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-[var(--brand)] sm:text-5xl">
              {usd(snap.comfortableMaxPrice)}
            </p>
            <p className="mt-2 text-sm text-[var(--text-2)]">
              The typical US home costs <strong className="text-[var(--text-1)]">{usd(snap.medianHomePrice)}</strong>,{" "}
              {snap.medianCanAfford ? (
                <span className="font-medium text-[var(--good-ink)]">within a comfortable budget.</span>
              ) : (
                <span className="font-medium text-[var(--critical)]">
                  a {usd(snap.medianHomePrice - snap.comfortableMaxPrice)} stretch beyond comfortable.
                </span>
              )}
            </p>
            {!snap.medianCanAfford && breakevenRate !== null && breakevenRate < currentRate && (
              <p className="mt-1 text-sm text-[var(--text-2)]">
                A rate at or below <strong className="text-[var(--text-1)]">{breakevenRate.toFixed(1)}%</strong> would
                put it comfortably in reach at this income. Set an alert to catch it.
              </p>
            )}
            <p className="mt-1 text-xs text-[var(--muted)]">
              &ldquo;Comfortable&rdquo; = ≤28% of income on housing. A lender may approve up to{" "}
              <strong className="text-[var(--text-2)]">{usd(snap.lenderMaxPrice)}</strong> (43% of income), the max rather than the comfortable choice.
            </p>
          </div>
          <div className="w-full max-w-xs">
            <p className="mb-1 text-xs text-[var(--muted)]">Affordability gauge (home price vs. income)</p>
            <Meter
              value={Math.max(0, Math.min(100, (6 - snap.priceToIncome) * 25))}
              leftLabel="Strained"
              midLabel=""
              rightLabel="Healthy"
            />
            <p className="mt-2 text-xs text-[var(--muted)]">
              Price-to-income {snap.priceToIncome.toFixed(1)}× &middot; ~3× is historically healthy
            </p>
          </div>
        </div>
      </Card>

      {/* Buyer stat grid */}
      <div>
        <SectionTitle hint="based on the median-priced US home + typical down payment">
          What buying the typical home looks like
        </SectionTitle>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="30-yr fixed rate" value={rate ? `${rate.rate.toFixed(2)}%` : `${currentRate.toFixed(2)}%`} sub={rate ? `as of ${rate.date}` : "reference (ingest FRED for live)"} />
          <Stat label={<>Monthly payment (<Term term="PITI" />)</>} value={usd(snap.medianHomePayment)} sub={`on a ${usd(snap.medianHomePrice)} home`} />
          <Stat label={<Term term="housing cost burden">Housing cost burden</Term>} value={pct(snap.housingBurden, 0)} sub="of gross income; under 30% is comfortable" tone={burdenTone} />
          <Stat label={<Term term="price-to-income">Price-to-income</Term>} value={`${snap.priceToIncome.toFixed(1)}×`} sub="home price ÷ income" tone={p2iTone} />
          <Stat label="Income to comfortably buy" value={usd(snap.incomeForMedianHome)} sub="at ≤28% housing (28/36 rule)" />
          <Stat label="Cash to buy" value={usd(snap.cashToClose.total)} sub="down + closing + ~2mo reserves" />
          <Stat label="20% down" value={usd(snap.downPayment20)} sub={`~${years(snap.yearsToSaveDownPayment)} at 10% savings`} />
          <Stat label="FHA 3.5% down" value={usd(snap.fhaDownPayment)} sub={`~${years(snap.fhaYearsToSave)}, the low-down path`} tone="good" />
        </div>
      </div>

      {/* Buying-power over time: the "true cost" story */}
      {(paymentTrend.length > 0 || p2iTrend.length > 0) && (
        <div>
          <SectionTitle>Buying power over time</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            {paymentTrend.length > 0 && <PaymentToBuyCard data={paymentTrend} latestIncome={latestIncome} />}
            {p2iTrend.length > 0 && <PriceToIncomeCard data={p2iTrend} />}
          </div>
        </div>
      )}

      {!dbConfigured() || rates.length === 0 ? (
        <EmptyNote>
          <strong>Charts are empty until you ingest data.</strong> Set <code>FRED_API_KEY</code> and run{" "}
          <code>ingest:fred</code> for live rates + Case-Shiller. The buyer snapshot above uses
          national reference figures and works now. Try the{" "}
          <Link href="/affordability" className="font-medium text-[var(--brand)] underline">
            Affordability
          </Link>{" "}
          and{" "}
          <Link href="/rent-vs-buy" className="font-medium text-[var(--brand)] underline">
            Rent vs. Buy
          </Link>{" "}
          tools; they work without any data.
        </EmptyNote>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="30-yr fixed mortgage rate"
            formula="+1 pt on the rate ≈ +10% on the monthly payment"
            source={rateSource}
            direction="lower"
            latest={rateChart.at(-1)?.value}
            benchmark={breakevenShown ? breakevenRate : undefined}
            format="percent2"
            whatFor={rateWhatFor}
          >
            <TimeSeriesChart data={rateChart} format="percent2" color={CHART.series1} refLines={rateLines} />
          </ChartCard>
          <ChartCard
            title="Case-Shiller price index"
            formula="index of repeat sales of the same homes, Jan 2000 = 100"
            source="S&P CoreLogic Case-Shiller via FRED"
            direction="lower"
            latest={caseShiller.at(-1)?.value}
            format="index"
            whatFor="The cleanest measure of pure US home-price change: it tracks repeat sales of the same houses, so the mix of what happened to sell doesn't distort it. A value of 300 means prices have tripled since Jan 2000. Falling or flat is a better entry point for buyers."
          >
            <TimeSeriesChart data={caseShiller} format="index" color={CHART.series2} />
          </ChartCard>
        </div>
      )}

      <p className="text-xs text-[var(--muted)]">{NATIONAL.sources}</p>
    </div>
  );
}
