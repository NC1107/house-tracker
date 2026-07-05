import TimeSeriesChart from "@/components/TimeSeriesChart";
import { ChartCard } from "@/components/ChartCard";
import { PageHeader, EmptyNote, Freshness } from "@/components/ui";
import { statesList, metrosForState, metricHistory, latestMetric, listAlertRules, dbConfigured } from "@/lib/queries";
import { yoyChangeSeries } from "@/lib/trends";
import { CHART } from "@/lib/chartTheme";
import AutoSubmitSelect from "@/components/AutoSubmitSelect";
import RememberSearch from "@/components/RememberSearch";
import { getProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ geo?: string; metro?: string }>;
}) {
  const { geo, metro } = await searchParams;
  const states = await statesList();
  const profile = await getProfile();
  const homeStateId = states.find((s) => s.name === profile.homeState)?.id;
  const stateId = geo ? Number(geo) : homeStateId ?? states[0]?.id;
  const state = states.find((s) => s.id === stateId);

  const metros = stateId ? await metrosForState(stateId) : [];
  const metroId = metro ? Number(metro) : undefined;
  const selectedMetro = metros.find((m) => m.id === metroId);

  // Show the metro if one is validly selected, else the whole state.
  const regionId = selectedMetro ? selectedMetro.id : stateId;
  const regionName = selectedMetro ? selectedMetro.name : state?.name;

  const [zhvi, zori, listPrice, newListings, fhfa] = regionId
    ? await Promise.all([
        metricHistory(regionId, "zhvi_all"),
        metricHistory(regionId, "zori"),
        metricHistory(regionId, "median_list_price"),
        metricHistory(regionId, "realtor_new_listings"),
        metricHistory(regionId, "fhfa_hpi"),
      ])
    : [[], [], [], [], []];
  const forecast = regionId ? await latestMetric(regionId, "zhvf_forecast") : null;
  const yoy = yoyChangeSeries(zhvi);

  // If the user set a price-move alert on this state, draw its trigger on the YoY chart.
  const yoyLines: { value: number; label: string }[] = [];
  if (regionId === stateId) {
    const rules = await listAlertRules();
    for (const r of rules) {
      if (!r.enabled || r.type !== "price_move" || Number(r.params.geographyId) !== stateId) continue;
      const t = Math.abs(Number(r.params.pctThreshold));
      if (!Number.isFinite(t)) continue;
      const direction = String(r.params.direction ?? "down");
      if (direction !== "up") yoyLines.push({ value: -t, label: `-${t}%` });
      if (direction !== "down") yoyLines.push({ value: t, label: `+${t}%` });
    }
  }

  return (
    <div className="space-y-6">
      <RememberSearch storageKey="ht:explore:last-search" />
      <PageHeader
        title="Region Explorer"
        subtitle="Home values, rents, and how fast prices are moving, by state or metro area."
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
              <AutoSubmitSelect name="geo" defaultValue={String(stateId)} className="input min-w-[10rem]">
                {states.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </AutoSubmitSelect>
            </label>
            <label className="block">
              <span className="label">Metro area</span>
              <select name="metro" defaultValue={metroId ? String(metroId) : ""} className="input min-w-[14rem]">
                <option value="">Whole state</option>
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

          {forecast && (
            <p className="text-sm text-[var(--text-2)]">
              Zillow expects {regionName} home values to move{" "}
              <strong style={{ color: forecast.value <= 0 ? "var(--good-ink)" : "var(--text-1)" }}>
                {forecast.value >= 0 ? "+" : ""}
                {forecast.value.toFixed(1)}%
              </strong>{" "}
              over the next 12 months (forecast as of {forecast.date}).
            </p>
          )}

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
                whatFor="How fast prices are rising or falling. Falling/low growth means a cooling market and a better negotiating position."
              >
                <TimeSeriesChart data={yoy} format="percent" color={CHART.series2} refLines={yoyLines} />
              </ChartCard>
              {zori.length > 0 && (
                <ChartCard
                  title={`${regionName}: typical rent`}
                  source="Zillow ZORI"
                  direction="lower"
                  whatFor="Typical asking rent, useful for a rent-vs-buy comparison in this area."
                >
                  <TimeSeriesChart data={zori} format="usd" color={CHART.series3} />
                </ChartCard>
              )}
              {listPrice.length > 0 && (
                <ChartCard
                  title={`${regionName}: median asking price`}
                  source="Realtor.com"
                  direction="lower"
                  whatFor="What sellers are asking right now. Falling asking prices show sellers adjusting to buyers before sale prices move."
                >
                  <TimeSeriesChart data={listPrice} format="usd" color={CHART.series1} />
                </ChartCard>
              )}
              {newListings.length > 0 && (
                <ChartCard
                  title={`${regionName}: new listings per month`}
                  source="Realtor.com"
                  direction="higher"
                  whatFor="Fresh supply hitting the market. More new listings means more choice and less competition per home."
                >
                  <TimeSeriesChart data={newListings} format="number" color={CHART.series2} />
                </ChartCard>
              )}
              {fhfa.length > 0 && (
                <ChartCard
                  title={`${regionName}: long-run price index (since 1975)`}
                  source="FHFA HPI"
                  direction="lower"
                  whatFor="Government price index across five decades. Puts today's prices in the longest possible context, including past booms and busts."
                >
                  <TimeSeriesChart data={fhfa} format="index" color={CHART.series3} />
                </ChartCard>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
