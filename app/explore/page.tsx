import TimeSeriesChart from "@/components/TimeSeriesChart";
import { ChartCard } from "@/components/ChartCard";
import { PageHeader, EmptyNote } from "@/components/ui";
import { statesList, metricHistory, dbConfigured } from "@/lib/queries";
import { yoyChangeSeries } from "@/lib/trends";
import { CHART } from "@/lib/chartTheme";

export const dynamic = "force-dynamic";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ geo?: string }>;
}) {
  const { geo } = await searchParams;
  const states = await statesList();
  const selectedId = geo ? Number(geo) : states[0]?.id;
  const selected = states.find((s) => s.id === selectedId);

  const zhvi = selectedId ? await metricHistory(selectedId, "zhvi_all") : [];
  const yoy = yoyChangeSeries(zhvi);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Region Explorer"
        subtitle="Home values and how fast they're moving, by state. Pick a state to see its trend and whether the market is heating up or cooling for buyers."
      />

      {!dbConfigured() || states.length === 0 ? (
        <EmptyNote>
          No geographies seeded yet. Run <code>npm run seed:geo</code> and{" "}
          <code>npm run ingest:zillow</code> to explore states.
        </EmptyNote>
      ) : (
        <>
          <form className="flex flex-wrap items-center gap-3">
            <label className="label mb-0">State</label>
            <select name="geo" defaultValue={String(selectedId)} className="input max-w-xs">
              {states.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button className="btn">View</button>
          </form>

          {zhvi.length === 0 ? (
            <EmptyNote>
              No home-value data for {selected?.name} yet. Run <code>npm run ingest:zillow</code> to
              populate state home values (Zillow ZHVI).
            </EmptyNote>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title={`${selected?.name}: typical home value`}
                source="Zillow ZHVI"
                direction="lower"
                whatFor="The typical home value in this state over time. Lower (or a dip) means better entry prices for buyers."
              >
                <TimeSeriesChart data={zhvi} format="usd" color={CHART.series1} />
              </ChartCard>
              <ChartCard
                title={`${selected?.name}: year-over-year price change`}
                source="derived from ZHVI"
                direction="lower"
                whatFor="How fast prices are rising or falling. Falling/low growth (or negative) means a cooling market — better negotiating position and less risk of overpaying."
              >
                <TimeSeriesChart data={yoy} format="percent" color={CHART.series2} />
              </ChartCard>
            </div>
          )}
        </>
      )}
    </div>
  );
}
