import { statesList, latestMetric, metricYoY, dbConfigured } from "@/lib/queries";
import { marketHeat, type MarketInputs } from "@/lib/marketheat";

export const dynamic = "force-dynamic";

const fmt = {
  monthsOfSupply: (v: number) => `${v.toFixed(1)} mo`,
  daysOnMarket: (v: number) => `${Math.round(v)} days`,
  priceDropsShare: (v: number) => `${(v * 100).toFixed(0)}%`,
  saleToList: (v: number) => v.toFixed(3),
  inventoryTrendYoY: (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(0)}%`,
} as const;

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ geo?: string }>;
}) {
  const { geo } = await searchParams;
  const states = await statesList();
  const selectedId = geo ? Number(geo) : states[0]?.id;
  const selected = states.find((s) => s.id === selectedId);

  let heat = null as ReturnType<typeof marketHeat> | null;
  if (selectedId) {
    const [mos, dom, drops, s2l, invTrend] = await Promise.all([
      latestMetric(selectedId, "months_of_supply"),
      latestMetric(selectedId, "days_on_market"),
      latestMetric(selectedId, "price_drops_share"),
      latestMetric(selectedId, "sale_to_list"),
      metricYoY(selectedId, "inventory"),
    ]);
    const inputs: MarketInputs = {
      monthsOfSupply: mos?.value,
      daysOnMarket: dom?.value,
      priceDropsShare: drops?.value,
      saleToList: s2l?.value,
      inventoryTrendYoY: invTrend ?? undefined,
    };
    heat = marketHeat(inputs);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Market Heat &amp; Deal Signals</h1>
        <p className="text-sm text-slate-500">
          A 0&ndash;100 buyer-leverage score from inventory, days-on-market, price cuts,
          and sale-to-list. Higher means more negotiating power for you.
        </p>
      </div>

      {!dbConfigured() || states.length === 0 ? (
        <div className="card text-sm text-slate-500">
          No geographies seeded yet. Run the Redfin ingestion to populate market metrics.
        </div>
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
            <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white">
              View
            </button>
          </form>

          {heat && heat.score !== null ? (
            <>
              <div className="card">
                <p className="text-sm text-slate-500">{selected?.name}</p>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="text-5xl font-bold" style={{ color: scoreColor(heat.score) }}>
                    {heat.score}
                  </span>
                  <span className="text-lg font-medium">{heat.label}</span>
                </div>
                <Meter score={heat.score} />
              </div>

              <div className="card">
                <h2 className="mb-3 font-semibold">Signals</h2>
                <div className="space-y-3">
                  {heat.components.map((c) => (
                    <div key={c.key}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-300">{c.label}</span>
                        <span className="text-slate-500">
                          {fmt[c.key](c.value)} &middot; score {c.score}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800">
                        <div
                          className="h-2 rounded-full"
                          style={{ width: `${c.score}%`, backgroundColor: scoreColor(c.score) }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="card text-sm text-slate-500">
              No market metrics for {selected?.name} yet. Run{" "}
              <code>npm run ingest:redfin</code> to populate inventory, days-on-market,
              price cuts, and sale-to-list.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function scoreColor(score: number): string {
  // seller (red) -> balanced (amber) -> buyer (green)
  if (score >= 58) return "#059669";
  if (score > 42) return "#d97706";
  return "#dc2626";
}

function Meter({ score }: { score: number }) {
  return (
    <div className="mt-3">
      <div className="relative h-3 w-full rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500">
        <div
          className="absolute top-1/2 h-5 w-1.5 -translate-y-1/2 rounded-full bg-slate-900 ring-2 ring-white dark:bg-white dark:ring-slate-900"
          style={{ left: `calc(${score}% - 3px)` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-400">
        <span>Seller&apos;s market</span>
        <span>Balanced</span>
        <span>Buyer&apos;s market</span>
      </div>
    </div>
  );
}
