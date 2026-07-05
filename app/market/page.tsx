import { PageHeader, Card, SectionTitle, Meter, Bar, EmptyNote, Freshness } from "@/components/ui";
import { statesList, statesWithMarketData, metrosWithMarketData, citiesWithMarketData, latestMetric, metricYoY, listAlertRules, dbConfigured } from "@/lib/queries";
import { marketHeat, type MarketInputs } from "@/lib/marketheat";
import { Term } from "@/components/Term";
import AutoSubmitSelect from "@/components/AutoSubmitSelect";
import RememberSearch from "@/components/RememberSearch";
import { getProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

const fmt = {
  monthsOfSupply: (v: number) => `${v.toFixed(1)} mo`,
  daysOnMarket: (v: number) => `${Math.round(v)} days`,
  priceDropsShare: (v: number) => `${(v * 100).toFixed(0)}%`,
  saleToList: (v: number) => v.toFixed(3),
  inventoryTrendYoY: (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(0)}%`,
} as const;

function scoreColor(score: number): string {
  if (score >= 58) return "var(--good)";
  if (score > 42) return "var(--warning)";
  return "var(--critical)";
}

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ geo?: string; metro?: string; city?: string }>;
}) {
  const { geo, metro, city } = await searchParams;
  const [allStates, withDataIds] = await Promise.all([statesList(), statesWithMarketData()]);
  const withData = new Set(withDataIds);
  // Only offer states that actually have Redfin metrics, so nobody lands on an empty view.
  const states = withData.size > 0 ? allStates.filter((s) => withData.has(s.id)) : allStates;
  const profile = await getProfile();
  const homeStateId = states.find((s) => s.name === profile.homeState)?.id;
  const requested = geo ? Number(geo) : undefined;
  const selectedId =
    requested && states.some((s) => s.id === requested) ? requested : homeStateId ?? states[0]?.id;
  const selected = states.find((s) => s.id === selectedId);
  const marketDataLoaded = withData.size > 0;

  // Drilldowns: only metros/cities that actually have Redfin metrics ingested.
  const [metros, citiesWithData] = selectedId
    ? await Promise.all([metrosWithMarketData(selectedId), citiesWithMarketData(selectedId)])
    : [[], []];
  const metroId = metro ? Number(metro) : undefined;
  const cityId = city ? Number(city) : undefined;
  const selectedMetro = metros.find((m) => m.id === metroId);
  const selectedCity = citiesWithData.find((c) => c.id === cityId);
  const regionId = selectedCity?.id ?? selectedMetro?.id ?? selectedId;
  const regionName = selectedCity?.name ?? selectedMetro?.name ?? selected?.name;

  let heat = null as ReturnType<typeof marketHeat> | null;
  let through: string | undefined;
  if (regionId) {
    const [mos, dom, drops, s2l, invTrend] = await Promise.all([
      latestMetric(regionId, "months_of_supply"),
      latestMetric(regionId, "days_on_market"),
      latestMetric(regionId, "price_drops_share"),
      latestMetric(regionId, "sale_to_list"),
      metricYoY(regionId, "inventory"),
    ]);
    const inputs: MarketInputs = {
      monthsOfSupply: mos?.value,
      daysOnMarket: dom?.value,
      priceDropsShare: drops?.value,
      saleToList: s2l?.value,
      inventoryTrendYoY: invTrend ?? undefined,
    };
    heat = marketHeat(inputs);
    through = [mos, dom, drops, s2l].map((m) => m?.date).filter(Boolean).sort().at(-1) as string | undefined;
  }

  // If the user set a buyer's-market alert for this state, mark its target on the meter.
  const rules = await listAlertRules();
  const heatRule = rules.find(
    (r) => r.enabled && r.type === "market_heat" && Number(r.params.geographyId) === regionId,
  );
  const targetScore = heatRule ? Number(heatRule.params.minScore) : undefined;

  return (
    <div className="space-y-6">
      <RememberSearch storageKey="ht:market:last-search" />
      <PageHeader
        title="Market Heat & Deal Signals"
        subtitle="A 0-100 buyer-leverage score from inventory, days-on-market, price cuts, and sale-to-list. Higher means more negotiating power for you."
        action={<Freshness date={through} />}
      />

      {!dbConfigured() || states.length === 0 ? (
        <EmptyNote>No geographies seeded yet. Run the Redfin ingestion to populate market metrics.</EmptyNote>
      ) : !marketDataLoaded ? (
        <EmptyNote>
          <strong>Market data isn&apos;t loaded yet.</strong> This page needs Redfin metrics
          (inventory, days-on-market, price cuts, sale-to-list). Run{" "}
          <code>npm run ingest:redfin</code> once; it covers every state in a single file, so all
          states light up together. On the prebuilt Docker image, pull the latest image first, then
          run the ingest command shown in <code>DEPLOY.md</code>.
        </EmptyNote>
      ) : (
        <>
          <form className="flex flex-wrap items-center gap-3">
            <label className="label mb-0">State</label>
            <AutoSubmitSelect name="geo" defaultValue={String(selectedId)} className="input max-w-xs">
              {states.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </AutoSubmitSelect>
            {citiesWithData.length > 0 && (
              <>
                <label className="label mb-0">City</label>
                <select name="city" defaultValue={cityId ? String(cityId) : ""} className="input max-w-xs">
                  <option value="">Any</option>
                  {citiesWithData.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            {metros.length > 0 && (
              <>
                <label className="label mb-0">Metro</label>
                <select name="metro" defaultValue={metroId ? String(metroId) : ""} className="input max-w-xs">
                  <option value="">Whole state</option>
                  {metros.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            <button className="btn">View</button>
          </form>

          {heat && heat.score !== null ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
              <Card>
                <p className="text-sm text-[var(--text-2)]">{regionName}</p>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="text-6xl font-bold tabular-nums" style={{ color: scoreColor(heat.score) }}>
                    {heat.score}
                  </span>
                  <span className="text-lg font-medium">{heat.label}</span>
                </div>
                <div className="mt-4">
                  <Meter
                    value={heat.score}
                    leftLabel="Seller's market"
                    midLabel="Balanced"
                    rightLabel="Buyer's market"
                    target={Number.isFinite(targetScore as number) ? targetScore : undefined}
                    targetLabel={Number.isFinite(targetScore as number) ? `Alert at ${targetScore}` : undefined}
                  />
                </div>
                <p className="mt-4 text-sm text-[var(--text-2)]">
                  <span className="font-medium text-[var(--text-1)]">What this means for you: </span>
                  {heat.score >= 58
                    ? "You likely have room to negotiate. Consider offering below ask and requesting concessions (closing help, repairs)."
                    : heat.score > 42
                      ? "A balanced market. Reasonable offers near asking price should compete without a bidding war."
                      : "A competitive seller's market. Expect to move fast, offer at or above ask, and keep contingencies tight."}
                </p>
              </Card>

              <Card>
                <SectionTitle hint="Redfin">Signals</SectionTitle>
                <div className="space-y-3">
                  {heat.components.map((c) => (
                    <div key={c.key}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-[var(--text-2)]"><Term term={c.label}>{c.label}</Term></span>
                        <span className="tabular-nums text-[var(--muted)]">
                          {fmt[c.key](c.value)} · score {c.score}
                        </span>
                      </div>
                      <Bar score={c.score} color={scoreColor(c.score)} />
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : (
            <EmptyNote>
              No market metrics for {regionName} yet. Run <code>npm run ingest:redfin</code> to
              populate inventory, days-on-market, price cuts, and sale-to-list.
            </EmptyNote>
          )}
        </>
      )}
    </div>
  );
}
