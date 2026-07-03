import TimeSeriesChart from "@/components/TimeSeriesChart";
import { statesList, metricHistory, dbConfigured } from "@/lib/queries";
import { usd } from "@/lib/format";

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
    ? await Promise.all([
        metricHistory(selectedId, "zhvi_all"),
        metricHistory(selectedId, "zori"),
      ])
    : [[], []];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Region Explorer</h1>
        <p className="text-sm text-slate-500">
          Drill from state down to metro, county, and ZIP as data is ingested.
        </p>
      </div>

      {!dbConfigured() || states.length === 0 ? (
        <div className="card text-sm text-slate-500">
          No geographies seeded yet. Run <code>npm run seed:geo</code> and the ingestion
          scripts to explore regions. The data model supports nation → state → metro →
          county → ZIP.
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

          <div className="card">
            <h2 className="mb-3 font-semibold">
              {selected?.name}: Home value (ZHVI)
            </h2>
            <TimeSeriesChart data={zhvi} yFormat={(v) => usd(v)} />
          </div>

          <div className="card">
            <h2 className="mb-3 font-semibold">{selected?.name}: Rent (ZORI)</h2>
            <TimeSeriesChart data={zori} color="#7c3aed" yFormat={(v) => usd(v)} />
          </div>
        </>
      )}
    </div>
  );
}
