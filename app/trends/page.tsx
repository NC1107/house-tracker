import TimeSeriesChart from "@/components/TimeSeriesChart";
import { ChartCard } from "@/components/ChartCard";
import { PageHeader, EmptyNote, Freshness } from "@/components/ui";
import { nationalSeries, rateHistory, dbConfigured } from "@/lib/queries";
import {
  paymentToBuySeries,
  priceToIncomeSeries,
  housingBurdenSeries,
  buyingPowerSeries,
  realIndexSeries,
  rateSpreadSeries,
} from "@/lib/trends";
import { CHART } from "@/lib/chartTheme";

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  const [rates, treasury, medianPrice, income, caseShiller, cpi, supply] = await Promise.all([
    rateHistory("30yr"),
    nationalSeries("treasury_10yr"),
    nationalSeries("median_sale_price_us"),
    nationalSeries("nominal_median_income"),
    nationalSeries("case_shiller_national"),
    nationalSeries("cpi"),
    nationalSeries("months_supply_new"),
  ]);

  const payment = paymentToBuySeries(medianPrice, rates);
  const burden = housingBurdenSeries(medianPrice, rates, income);
  const buyingPower = buyingPowerSeries(rates, income);
  const p2i = priceToIncomeSeries(medianPrice, income);
  const realPrice = realIndexSeries(caseShiller, cpi);
  const spread = rateSpreadSeries(rates, treasury);

  const hasData = payment.length > 0 || rates.length > 0;
  const through = [rates, medianPrice, supply, caseShiller]
    .map((s) => s.at(-1)?.date)
    .filter(Boolean)
    .sort()
    .at(-1) as string | undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buying-Power Trends"
        subtitle="The long view on affordability. Each chart says which direction is good for you as a buyer."
        action={<Freshness date={through} />}
      />

      {!dbConfigured() || !hasData ? (
        <EmptyNote>
          These charts need the FRED ingestion. Set <code>FRED_API_KEY</code> and run{" "}
          <code>npm run ingest:fred</code> to populate them.
        </EmptyNote>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Monthly payment to buy the typical home"
            source="median price × rate"
            direction="lower"
            whatFor="The real monthly cost of the median home over time (full PITI, 15% down). The 2021-2023 spike is the rate shock: the same house, a far bigger payment."
          >
            <TimeSeriesChart data={payment} format="usd" color={CHART.series2} />
          </ChartCard>

          <ChartCard
            title="What the median income can buy (buying power)"
            source="max qualifying price"
            direction="higher"
            whatFor="How much house a typical household qualifies for at each period's rate. When this falls, your income buys less home even if your salary didn't change."
          >
            <TimeSeriesChart data={buyingPower} format="usd" color={CHART.series1} />
          </ChartCard>

          <ChartCard
            title="Housing-cost burden"
            source="payment ÷ income"
            direction="lower"
            whatFor="Payment on the median home as a share of median income. Above ~30% is considered cost-burdened, where lenders and budgets both strain."
          >
            <TimeSeriesChart data={burden} format="percent" color={CHART.series2} />
          </ChartCard>

          <ChartCard
            title="Home price-to-income ratio"
            source="price ÷ income"
            direction="lower"
            whatFor="The classic valuation gauge. Around 3-4x income is historically normal; 5x+ means homes are expensive relative to what people earn."
          >
            <TimeSeriesChart data={p2i} format="ratio" color={CHART.series1} />
          </ChartCard>

          <ChartCard
            title="Real (inflation-adjusted) home prices"
            source="Case-Shiller ÷ CPI, rebased to 100"
            direction="lower"
            whatFor="Appreciation above inflation, rebased to 100. Flat means homes just kept pace with the cost of living; a steep rise means prices outran everything else, a stretched market."
          >
            <TimeSeriesChart data={realPrice} format="index" color={CHART.series3} />
          </ChartCard>

          <ChartCard
            title="New-home supply"
            source="FRED MSACSR"
            direction="higher"
            whatFor="Months it would take to sell current for-sale inventory. More supply means more choice and more negotiating leverage for buyers (about 6 months is balanced)."
          >
            <TimeSeriesChart data={supply} format="months" color={CHART.series1} />
          </ChartCard>

          <ChartCard
            title="Mortgage rate vs. 10-year Treasury (spread)"
            source="30-yr minus 10-yr, in points"
            direction="context"
            whatFor="Mortgage rates track the 10-yr Treasury plus a spread, normally ~1.7 points. A wide spread hints mortgage rates could ease even without Fed cuts, worth watching if you're timing a purchase."
          >
            <TimeSeriesChart data={spread} format="percent" color={CHART.series2} />
          </ChartCard>
        </div>
      )}
    </div>
  );
}
