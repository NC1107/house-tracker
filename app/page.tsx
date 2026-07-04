import Link from "next/link";
import TimeSeriesChart from "@/components/TimeSeriesChart";
import { PageHeader, Card, Stat, SectionTitle, Meter, EmptyNote } from "@/components/ui";
import { ChartCard } from "@/components/ChartCard";
import { Term } from "@/components/Term";
import { latestMortgageRate, rateHistory, nationalSeries, dbConfigured } from "@/lib/queries";
import { buyerSnapshot, NATIONAL } from "@/lib/reference";
import { getProfile } from "@/lib/profile";
import { paymentToBuySeries, priceToIncomeSeries } from "@/lib/trends";
import { usd, pct } from "@/lib/format";
import { CHART } from "@/lib/chartTheme";

export const dynamic = "force-dynamic";

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

  // Derived buying-power trends (the "true cost" story buyers care about most).
  const paymentTrend = paymentToBuySeries(medianPrice, rates);
  const p2iTrend = priceToIncomeSeries(medianPrice, income);

  const burdenTone = snap.housingBurden > 0.36 ? "critical" : snap.housingBurden > 0.3 ? "warning" : "good";
  const p2iTone = snap.priceToIncome > 5 ? "critical" : snap.priceToIncome > 4 ? "warning" : "good";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Can we afford a home?"
        subtitle="Prices, rates, and what they mean for buying — set your numbers to make it about you."
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
              The typical US home costs <strong className="text-[var(--text-1)]">{usd(snap.medianHomePrice)}</strong> —{" "}
              {snap.medianCanAfford ? (
                <span className="font-medium text-[var(--good-ink)]">within a comfortable budget.</span>
              ) : (
                <span className="font-medium text-[var(--critical)]">
                  a {usd(snap.medianHomePrice - snap.comfortableMaxPrice)} stretch beyond comfortable.
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              &ldquo;Comfortable&rdquo; = ≤28% of income on housing. A lender may approve up to{" "}
              <strong className="text-[var(--text-2)]">{usd(snap.lenderMaxPrice)}</strong> (43% of income) — the max, not the comfortable choice.
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
          <Stat label={<Term term="housing cost burden">Housing cost burden</Term>} value={pct(snap.housingBurden, 0)} sub="of gross income · <30% is comfortable" tone={burdenTone} />
          <Stat label={<Term term="price-to-income">Price-to-income</Term>} value={`${snap.priceToIncome.toFixed(1)}×`} sub="home price ÷ income" tone={p2iTone} />
          <Stat label="Income to comfortably buy" value={usd(snap.incomeForMedianHome)} sub="at ≤28% housing (28/36 rule)" />
          <Stat label="Cash to buy" value={usd(snap.cashToClose.total)} sub="down + closing + ~2mo reserves" hint="upfront" />
          <Stat label="20% down" value={usd(snap.downPayment20)} sub={`~${snap.yearsToSaveDownPayment.toFixed(0)} yrs at 10% savings`} />
          <Stat label="FHA 3.5% down" value={usd(snap.fhaDownPayment)} sub={`~${snap.fhaYearsToSave.toFixed(0)} yrs — the low-down path`} tone="good" />
        </div>
      </div>

      {/* Buying-power over time — the "true cost" story */}
      {(paymentTrend.length > 0 || p2iTrend.length > 0) && (
        <div>
          <SectionTitle hint="see the Trends page for more">Buying power over time</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            {paymentTrend.length > 0 && (
              <ChartCard
                title="Monthly payment to buy the typical US home"
                source="median price × rate"
                direction="lower"
                whatFor="The real monthly cost of the median home (full PITI, 15% down). The 2021→2023 spike is the rate shock — same house, far bigger payment."
              >
                <TimeSeriesChart data={paymentTrend} format="usd" color={CHART.series2} />
              </ChartCard>
            )}
            {p2iTrend.length > 0 && (
              <ChartCard
                title="Home price-to-income ratio"
                source="price ÷ income"
                direction="lower"
                whatFor="A valuation gauge — ~3–4× is historically normal, 5×+ is stretched."
              >
                <TimeSeriesChart data={p2iTrend} format="number" color={CHART.series1} />
              </ChartCard>
            )}
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
          tools — they work without any data.
        </EmptyNote>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <SectionTitle hint={dailyRate.length ? "Optimal Blue (daily) via FRED" : "Freddie Mac via FRED"}>
              30-year fixed mortgage rate
            </SectionTitle>
            <TimeSeriesChart data={rateChart} format="percent2" color={CHART.series1} />
          </Card>
          <Card>
            <SectionTitle hint="S&P / FRED">Case-Shiller US National Home Price Index</SectionTitle>
            <TimeSeriesChart data={caseShiller} format="index" color={CHART.series2} />
          </Card>
        </div>
      )}

      <p className="text-xs text-[var(--muted)]">{NATIONAL.sources}</p>
    </div>
  );
}
