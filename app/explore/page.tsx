import TimeSeriesChart from "@/components/TimeSeriesChart";
import { ChartCard } from "@/components/ChartCard";
import { PageHeader, EmptyNote, Freshness } from "@/components/ui";
import { statesList, metrosForState, metricHistory, dbConfigured } from "@/lib/queries";
import { yoyChangeSeries } from "@/lib/trends";
import { CHART } from "@/lib/chartTheme";

export const dynamic = "force-dynamic";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ geo?: string; metro?: string }>;
}) {
  const { geo, metro } = await searchParams;
  const states = await statesList();
  const stateId = geo ? Number(geo) : states[0]?.id;
  const state = states.find((s) => s.id === stateId);

  const metros = stateId ? await metrosForState(stateId) : [];
  const metroId = metro ? Number(metro) : undefined;
  const selectedMetro = metros.find((m) => m.id === metroId);

  // Show the metro if one is validly selected, else the whole state.
  const regionId = selectedMetro ? selectedMetro.id : stateId;
  const regionName = selectedMetro ? selectedMetro.name : state?.name;

  const [zhvi, zori] = regionId
    ? await Promise.all([metricHistory(regionId, "zhvi_all"), metricHistory(regionId, "zori")])
    : [[], []];
  const yoy = yoyChangeSeries(zhvi);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Region Explorer"
        subtitle="Home values, rents, and how fast prices are moving — by state or metro area."
        action={<Freshness date={zhvi.at(-1)?.date} />}
      />

      {!dbConfigured() || states.length === 0 ? (
        <EmptyNote>
          No geographies seeded yet. Run <code>npm run seed:geo</code> and{" "}
          <code>npm run ingest:zillow</code> to explore states and metros.
        </EmptyNote>
      ) : (
        <>
          <form className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="label">State</span>
              <select name="geo" defaultValue={String(stateId)} className="input min-w-[10rem]">
                {states.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Metro area</span>
              <select name="metro" defaultValue={metroId ? String(metroId) : ""} className="input min-w-[14rem]">
                <option value="">— Whole state —</option>
                {metros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn">View</button>
            {metros.length === 0 && (
              <span className="pb-2 text-xs text-[var(--muted)]">Run metro ingestion to drill into metros.</span>
            )}
          </form>

          {zhvi.length === 0 ? (
            <EmptyNote>
              No home-value data for {regionName} yet. Run <code>npm run ingest:zillow</code> to populate
              home values (Zillow ZHVI/ZORI).
            </EmptyNote>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title={`${regionName}: typical home value`}
                source="Zillow ZHVI"
                direction="lower"
                whatFor="The typical home value over time. Lower (or a dip) means better entry prices for buyers."
              >
                <TimeSeriesChart data={zhvi} format="usd" color={CHART.series1} />
              </ChartCard>
              <ChartCard
                title={`${regionName}: year-over-year price change`}
                source="derived from ZHVI"
                direction="lower"
                whatFor="How fast prices are rising or falling. Falling/low growth means a cooling market — better negotiating position."
              >
                <TimeSeriesChart data={yoy} format="percent" color={CHART.series2} />
              </ChartCard>
              {zori.length > 0 && (
                <ChartCard
                  title={`${regionName}: typical rent`}
                  source="Zillow ZORI"
                  direction="lower"
                  whatFor="Typical asking rent — useful for a rent-vs-buy comparison in this area."
                >
                  <TimeSeriesChart data={zori} format="usd" color={CHART.series3} />
                </ChartCard>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
