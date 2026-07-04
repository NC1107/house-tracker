import TimeSeriesChart from "@/components/TimeSeriesChart";
import { PageHeader, Card, SectionTitle, EmptyNote } from "@/components/ui";
import { statesList, metricHistory, dbConfigured } from "@/lib/queries";
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

  const [zhvi, zori] = selectedId
    ? await Promise.all([metricHistory(selectedId, "zhvi_all"), metricHistory(selectedId, "zori")])
    : [[], []];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Region Explorer"
        subtitle="Drill from state down to metro, county, and ZIP as data is ingested. Compare home values and rents over time."
      />

      {!dbConfigured() || states.length === 0 ? (
        <EmptyNote>
          No geographies seeded yet. Run <code>npm run seed:geo</code> and the ingestion
          scripts to explore regions. The data model supports nation → state → metro → county → ZIP.
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

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <SectionTitle hint="Zillow ZHVI">{selected?.name}: typical home value</SectionTitle>
              <TimeSeriesChart data={zhvi} format="usd" color={CHART.series1} />
            </Card>
            <Card>
              <SectionTitle hint="Zillow ZORI">{selected?.name}: typical rent</SectionTitle>
              <TimeSeriesChart data={zori} format="usd" color={CHART.series3} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
