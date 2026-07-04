import Link from "next/link";
import TimeSeriesChart from "@/components/TimeSeriesChart";
import { PageHeader, Card, Stat, SectionTitle, Meter, EmptyNote } from "@/components/ui";
import { latestMortgageRate, rateHistory, nationalSeries, dbConfigured } from "@/lib/queries";
import { buyerSnapshot, NATIONAL } from "@/lib/reference";
import { paymentToBuySeries, priceToIncomeSeries } from "@/lib/trends";
import { usd, pct } from "@/lib/format";
import { CHART } from "@/lib/chartTheme";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [rate, rates, caseShiller, medianPrice, income] = await Promise.all([
    latestMortgageRate("30yr"),
    rateHistory("30yr"),
    nationalSeries("case_shiller_national"),
    nationalSeries("median_sale_price_us"),
    nationalSeries("real_median_income"),
  ]);

  const currentRate = rate?.rate ?? 6.8;
  const snap = buyerSnapshot(currentRate);

  // Derived buying-power trends (the "true cost" story buyers care about most).
  const paymentTrend = paymentToBuySeries(medianPrice, rates);
  const p2iTrend = priceToIncomeSeries(medianPrice, income);

  const burdenTone = snap.housingBurden > 0.36 ? "critical" : snap.housingBurden > 0.3 ? "warning" : "good";
  const p2iTone = snap.priceToIncome > 5 ? "critical" : snap.priceToIncome > 4 ? "warning" : "good";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Can we afford a home?"
        subtitle="The national picture for a typical American household — prices, rates, and what they mean for buying."
      />

      {/* Hero: the median household's buying power */}
      <Card className="bg-gradient-to-br from-[var(--surface)] to-[var(--surface-2)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="badge">Median US household</span>
            <p className="mt-3 text-sm text-[var(--text-2)]">
              Earning <strong className="text-[var(--text-1)]">{usd(snap.medianIncome)}</strong>/yr, at today&apos;s{" "}
              <strong className="text-[var(--text-1)]">{currentRate.toFixed(2)}%</strong> rate, can afford about
            </p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-[var(--brand)] sm:text-5xl">
              {usd(snap.medianMaxPrice)}
            </p>
            <p className="mt-2 text-sm text-[var(--text-2)]">
              The typical US home costs <strong className="text-[var(--text-1)]">{usd(snap.medianHomePrice)}</strong> —{" "}
              {snap.medianCanAfford ? (
                <span className="font-medium text-[var(--good)]">within reach.</span>
              ) : (
                <span className="font-medium text-[var(--critical)]">
                  a {usd(snap.medianHomePrice - snap.medianMaxPrice)} gap.
                </span>
              )}
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
          <Stat label="Monthly payment (PITI)" value={usd(snap.medianHomePayment)} sub={`on a ${usd(snap.medianHomePrice)} home`} />
          <Stat label="Housing cost burden" value={pct(snap.housingBurden, 0)} sub="of gross income · <30% is comfortable" tone={burdenTone} />
          <Stat label="Price-to-income" value={`${snap.priceToIncome.toFixed(1)}×`} sub="home price ÷ median income" tone={p2iTone} />
          <Stat label="Income to buy it" value={usd(snap.incomeForMedianHome)} sub="to qualify comfortably" />
          <Stat label="20% down payment" value={usd(snap.downPayment20)} sub={`~${snap.yearsToSaveDownPayment.toFixed(0)} yrs saving 10%/yr`} />
          <Stat label="Median rent" value={`${usd(NATIONAL.medianAskingRent)}/mo`} sub="US asking rent (approx)" />
          <Stat label="Buying signal" value={rate ? (rate.rate < 6 ? "Favorable" : "Watch") : "Watch"} sub="rate-based, illustrative" tone={rate && rate.rate < 6 ? "good" : "neutral"} />
        </div>
      </div>

      {/* Buying-power over time — the "true cost" story */}
      {(paymentTrend.length > 0 || p2iTrend.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {paymentTrend.length > 0 && (
            <Card>
              <SectionTitle hint="median price × rate of the day">
                Monthly payment to buy the typical US home
              </SectionTitle>
              <TimeSeriesChart data={paymentTrend} format="usd" color={CHART.series2} />
              <p className="mt-2 text-xs text-[var(--muted)]">
                Full PITI at 15% down. Shows how the rate shock reshaped affordability even when
                prices moved little.
              </p>
            </Card>
          )}
          {p2iTrend.length > 0 && (
            <Card>
              <SectionTitle hint="median price ÷ median income">Home price-to-income ratio</SectionTitle>
              <TimeSeriesChart data={p2iTrend} format="number" color={CHART.series1} />
              <p className="mt-2 text-xs text-[var(--muted)]">
                A valuation gauge — ~3–4× is historically normal, 5×+ is stretched.
              </p>
            </Card>
          )}
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
            <SectionTitle hint="Freddie Mac via FRED">30-year fixed mortgage rate</SectionTitle>
            <TimeSeriesChart data={rates} format="percent" color={CHART.series1} />
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
