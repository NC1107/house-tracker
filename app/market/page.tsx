import { PageHeader, Card, SectionTitle, Meter, Bar, EmptyNote, Freshness } from "@/components/ui";
import { statesList, latestMetric, metricYoY, dbConfigured } from "@/lib/queries";
import { marketHeat, type MarketInputs } from "@/lib/marketheat";
import { Term } from "@/components/Term";

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
  searchParams: Promise<{ geo?: string }>;
}) {
  const { geo } = await searchParams;
  const states = await statesList();
  const selectedId = geo ? Number(geo) : states[0]?.id;
  const selected = states.find((s) => s.id === selectedId);

  let heat = null as ReturnType<typeof marketHeat> | null;
  let through: string | undefined;
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
    through = [mos, dom, drops, s2l].map((m) => m?.date).filter(Boolean).sort().at(-1) as string | undefined;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Market Heat & Deal Signals"
        subtitle="A 0–100 buyer-leverage score from inventory, days-on-market, price cuts, and sale-to-list. Higher means more negotiating power for you."
        action={<Freshness date={through} />}
      />

      {!dbConfigured() || states.length === 0 ? (
        <EmptyNote>No geographies seeded yet. Run the Redfin ingestion to populate market metrics.</EmptyNote>
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

          {heat && heat.score !== null ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
              <Card>
                <p className="text-sm text-[var(--text-2)]">{selected?.name}</p>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="text-6xl font-bold tabular-nums" style={{ color: scoreColor(heat.score) }}>
                    {heat.score}
                  </span>
                  <span className="text-lg font-medium">{heat.label}</span>
                </div>
                <div className="mt-4">
                  <Meter value={heat.score} leftLabel="Seller's market" midLabel="Balanced" rightLabel="Buyer's market" />
                </div>
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
              No market metrics for {selected?.name} yet. Run <code>npm run ingest:redfin</code> to
              populate inventory, days-on-market, price cuts, and sale-to-list.
            </EmptyNote>
          )}
        </>
      )}
    </div>
  );
}
