import Link from "next/link";
import TimeSeriesChart from "@/components/TimeSeriesChart";
import { latestMortgageRate, rateHistory, nationalSeries, dbConfigured } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [rate, rates, caseShiller] = await Promise.all([
    latestMortgageRate("30yr"),
    rateHistory("30yr"),
    nationalSeries("case_shiller_national"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-sm text-slate-500">
          The national picture — prices, rates, and what it means for buying.
        </p>
      </div>

      {!dbConfigured() && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <strong>Database not configured.</strong> Set <code>DATABASE_URL</code> and run{" "}
          <code>npm run seed:geo &amp;&amp; npm run ingest:fred &amp;&amp; npm run ingest:zillow</code> to
          populate charts. The{" "}
          <Link href="/affordability" className="underline">
            Affordability calculator
          </Link>{" "}
          works right now without any data.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="30-yr fixed rate"
          value={rate ? `${rate.rate.toFixed(2)}%` : "—"}
          sub={rate ? `as of ${rate.date}` : "no data yet"}
        />
        <StatCard
          label="Case-Shiller (national)"
          value={caseShiller.at(-1) ? caseShiller.at(-1)!.value.toFixed(1) : "—"}
          sub="index, latest"
        />
        <StatCard
          label="Buying signal"
          value={rate ? (rate.rate < 6 ? "Favorable" : "Watch") : "—"}
          sub="rate-based, illustrative"
        />
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">30-year fixed mortgage rate</h2>
        <TimeSeriesChart data={rates} format="percent" />
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Case-Shiller US National Home Price Index</h2>
        <TimeSeriesChart data={caseShiller} color="#059669" format="index" />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}
