import { PageHeader, Card, EmptyNote } from "@/components/ui";
import AddAlertForm from "@/components/AddAlertForm";
import { listAlertRules, statesList, dbConfigured } from "@/lib/queries";
import { deleteAlert, sendTest } from "./actions";
import { describeListingFilters } from "@/lib/alerts";

export const dynamic = "force-dynamic";

function describe(rule: { type: string; params: Record<string, unknown> }, stateName: (id?: number) => string): string {
  const p = rule.params;
  if (rule.type === "rate_threshold") return `30-yr rate drops below ${p.below}%`;
  if (rule.type === "market_heat") return `${stateName(p.geographyId as number)} buyer-leverage score reaches ${p.minScore}`;
  if (rule.type === "price_move") {
    const dir = p.direction === "up" ? "rise" : p.direction === "any" ? "move" : "fall";
    return `${stateName(p.geographyId as number)} prices ${dir} by ≥ ${p.pctThreshold}% YoY`;
  }
  if (rule.type === "listing_match") {
    return `New listing in ${p.stateName}: ${describeListingFilters(p)}`;
  }
  return rule.type;
}

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ test?: string }> }) {
  const { test } = await searchParams;
  const [rules, states] = await Promise.all([listAlertRules(), statesList()]);
  const stateName = (id?: number) => states.find((s) => s.id === id)?.name ?? "a state";
  const configured = Boolean(process.env.RESEND_API_KEY && process.env.ALERT_EMAIL);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        subtitle="Get an email when the market moves your way: a rate drop, a state turning into a buyer's market, or prices falling. Evaluated daily."
      />

      {test === "sent" && (
        <div className="rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--good)_12%,transparent)] p-3 text-sm" style={{ color: "var(--good-ink)" }}>
          Test email sent. Check your inbox.
        </div>
      )}
      {test === "fail" && (
        <div className="rounded-lg border border-[var(--border)] p-3 text-sm" style={{ color: "var(--critical)" }}>
          Test email failed. Check RESEND_API_KEY / ALERT_EMAIL and the server logs.
        </div>
      )}

      {!configured && (
        <EmptyNote>
          Email delivery isn&apos;t configured yet. Set <code>RESEND_API_KEY</code> and{" "}
          <code>ALERT_EMAIL</code> (your address) in the environment. You can still add rules now;
          the daily job will email once those are set.
        </EmptyNote>
      )}

      {!dbConfigured() ? (
        <EmptyNote>Connect a database to save alert rules.</EmptyNote>
      ) : (
        <>
          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-semibold">Your alerts</h2>
              <form action={sendTest}>
                <button className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--surface-2)]">
                  Send test email
                </button>
              </form>
            </div>
            {rules.length === 0 ? (
              <p className="text-sm text-[var(--text-2)]">No alerts yet. Add one below.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {rules.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>{describe(r, stateName)}</span>
                    <form action={deleteAlert}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="text-[var(--text-2)] hover:text-[var(--critical)]" aria-label="Delete alert">Remove</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <AddAlertForm states={states} />
        </>
      )}
    </div>
  );
}
