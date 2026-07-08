import TimeSeriesChart from "@/components/TimeSeriesChart";
import { ChartCard } from "@/components/ChartCard";
import { CHART } from "@/lib/chartTheme";
import { usd } from "@/lib/format";
import type { SeriesPoint } from "@/lib/types";

/**
 * Chart cards shared verbatim by the Overview and Trends pages, so their copy,
 * benchmarks, and chips stay in sync from one definition.
 */

/** Monthly PITI to buy the median-priced US home, with a 28%-of-income comfort line. */
export function PaymentToBuyCard({
  data,
  latestIncome,
}: {
  data: SeriesPoint[];
  latestIncome: number | null;
}) {
  const comfortable = latestIncome ? Math.round((latestIncome * 0.28) / 12) : undefined;
  return (
    <ChartCard
      title="Monthly cost to buy a home"
      formula="payment = PITI on the median-priced home, 15% down, at that month's rate"
      source="FRED: median sale price (MSPUS) + Freddie Mac 30-yr rates"
      direction="lower"
      latest={data.at(-1)?.value}
      benchmark={comfortable}
      format="usd"
      whatFor="The real monthly cost of the median US home (full PITI: principal, interest, taxes, insurance). The 2021-2023 spike is the rate shock: same house, far bigger payment. The green dashed line is a comfortable budget for the median household: 28% of today's median income."
    >
      <TimeSeriesChart
        data={data}
        format="usd"
        color={CHART.series2}
        refLines={
          comfortable !== undefined
            ? [{ value: comfortable, label: `Comfortable ≤ ${usd(comfortable)}`, color: CHART.good }]
            : []
        }
      />
    </ChartCard>
  );
}

/** Median home price over median income, with the ~3.5x healthy line. */
export function PriceToIncomeCard({ data }: { data: SeriesPoint[] }) {
  return (
    <ChartCard
      title="Price-to-income ratio"
      formula="ratio = median home price ÷ median household income"
      source="FRED: median sale price (MSPUS) ÷ median household income"
      direction="lower"
      latest={data.at(-1)?.value}
      benchmark={3.5}
      format="ratio"
      whatFor="A valuation gauge: how many years of gross income the typical home costs. Around 3-4× is historically normal (the green dashed line marks 3.5×); 5×+ means homes are expensive relative to what people earn."
    >
      <TimeSeriesChart
        data={data}
        format="ratio"
        color={CHART.series1}
        refLines={[{ value: 3.5, label: "~3.5× healthy", color: CHART.good }]}
      />
    </ChartCard>
  );
}
