import TimeSeriesChart from "@/components/TimeSeriesChart";
import { ChartCard } from "@/components/ChartCard";
import { PaymentToBuyCard, PriceToIncomeCard } from "@/components/SharedChartCards";
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
import { usd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  const [rates, treasury, medianPrice, income, caseShiller, cpi, supply, starts] = await Promise.all([
    rateHistory("30yr"),
    nationalSeries("treasury_10yr"),
    nationalSeries("median_sale_price_us"),
    nationalSeries("nominal_median_income"),
    nationalSeries("case_shiller_national"),
    nationalSeries("cpi"),
    nationalSeries("months_supply_new"),
    nationalSeries("housing_starts"),
  ]);

  const payment = paymentToBuySeries(medianPrice, rates);
  const burden = housingBurdenSeries(medianPrice, rates, income);
  const buyingPower = buyingPowerSeries(rates, income);
  const p2i = priceToIncomeSeries(medianPrice, income);
  const realPrice = realIndexSeries(caseShiller, cpi);
  const spread = rateSpreadSeries(rates, treasury);

  // "Ideal world" benchmarks: horizontal lines that let the eye judge the level against
  // a healthy norm, not just the trend's shape. Green = a good-for-buyers threshold,
  // magenta = a neutral historical norm.
  const latestIncome = income.at(-1)?.value ?? null;
  const latestPrice = medianPrice.at(-1)?.value;

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
          <PaymentToBuyCard data={payment} latestIncome={latestIncome} />

          <ChartCard
            title="Home buying power"
            formula="max price a median income qualifies for at that month's rate"
            source="FRED: median household income + Freddie Mac 30-yr rates"
            direction="higher"
            latest={buyingPower.at(-1)?.value}
            benchmark={latestPrice}
            format="usd"
            whatFor="How much house a typical household qualifies for at each period's rate. When this falls, your income buys less home even if your salary didn't change. The magenta dashed line is today's median home price: buying power above it means the typical home is within reach."
          >
            <TimeSeriesChart
              data={buyingPower}
              format="usd"
              color={CHART.series1}
              refLines={
                latestPrice
                  ? [{ value: latestPrice, label: `Median home ${usd(latestPrice)}`, color: CHART.benchmark }]
                  : []
              }
            />
          </ChartCard>

          <ChartCard
            title="Payment as % of income"
            formula="burden = payment on the median home ÷ median monthly income"
            source="FRED: median sale price, 30-yr rates, median household income"
            direction="lower"
            latest={burden.at(-1)?.value}
            benchmark={30}
            format="percent"
            whatFor="Payment on the median home as a share of median income. Above the 30% dashed line a household is considered cost-burdened; lenders and budgets both strain there. Under 28% is the classic comfortable zone."
          >
            <TimeSeriesChart
              data={burden}
              format="percent"
              color={CHART.series2}
              refLines={[{ value: 30, label: "30% cost-burdened", color: CHART.warning }]}
            />
          </ChartCard>

          <PriceToIncomeCard data={p2i} />

          <ChartCard
            title="Home prices after inflation"
            formula="index = Case-Shiller ÷ CPI, rebased to 100 at the start"
            source="FRED: S&P Case-Shiller national index ÷ CPI"
            direction="lower"
            latest={realPrice.at(-1)?.value}
            benchmark={100}
            format="index"
            whatFor="Appreciation above inflation. On the 100 dashed line, homes merely kept pace with the cost of living; a steep rise above it means prices outran everything else, a stretched market."
          >
            <TimeSeriesChart
              data={realPrice}
              format="index"
              color={CHART.series3}
              refLines={[{ value: 100, label: "100 = kept pace with inflation", color: CHART.benchmark }]}
            />
          </ChartCard>

          <ChartCard
            title="New-home supply"
            formula="months to sell the current for-sale inventory at today's pace"
            source="FRED: monthly supply of new houses (MSACSR)"
            direction="higher"
            latest={supply.at(-1)?.value}
            benchmark={6}
            format="months"
            whatFor="How long the current for-sale inventory would last. More supply means more choice and more negotiating leverage for buyers. The dashed line at 6 months is the conventional balanced market; below it sellers have the upper hand."
          >
            <TimeSeriesChart
              data={supply}
              format="months"
              color={CHART.series1}
              refLines={[{ value: 6, label: "6 mo balanced", color: CHART.good }]}
            />
          </ChartCard>

          {starts.length > 0 && (
            <ChartCard
              title="Housing starts"
              formula="new housing units started per year (thousands, seasonally adjusted)"
              source="FRED: housing starts (HOUST)"
              direction="higher"
              latest={starts.at(-1)?.value}
              benchmark={1500}
              format="number"
              whatFor="The pipeline of new homes. Building near the ~1.5M/yr dashed line roughly keeps up with new-household demand; sustained building below it deepens the shortage and props up prices."
            >
              <TimeSeriesChart
                data={starts}
                format="number"
                color={CHART.series3}
                refLines={[{ value: 1500, label: "~1.5M/yr meets demand", color: CHART.good }]}
              />
            </ChartCard>
          )}

          <ChartCard
            title="Mortgage-Treasury spread"
            formula="spread = 30-yr mortgage rate − 10-yr Treasury yield, in points"
            source="FRED: Freddie Mac 30-yr rate − 10-yr Treasury (DGS10)"
            direction="context"
            latest={spread.at(-1)?.value}
            format="percent"
            whatFor="Mortgage rates track the 10-yr Treasury plus a spread, normally ~1.7 points (the dashed line). A spread well above it hints mortgage rates could ease even without Fed cuts, worth watching if you're timing a purchase."
          >
            <TimeSeriesChart
              data={spread}
              format="percent"
              color={CHART.series2}
              refLines={[{ value: 1.7, label: "~1.7 pt normal", color: CHART.benchmark }]}
            />
          </ChartCard>
        </div>
      )}
    </div>
  );
}
