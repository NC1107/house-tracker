export const dynamic = "force-dynamic";

const alertTypes = [
  {
    title: "Mortgage rate threshold",
    desc: "Notify me when the 30-yr fixed drops below a rate I set (e.g. < 6%).",
  },
  {
    title: "Affordability change",
    desc: "Notify me when a watched region crosses into (or out of) my budget based on my income and down payment.",
  },
  {
    title: "Price move in a watched area",
    desc: "Notify me on notable price drops or rises in ZIPs / metros I'm watching.",
  },
  {
    title: "Market-heat shift",
    desc: "Notify me when inventory, days-on-market, or price-drop share signal a buyer's market.",
  },
  {
    title: "Weekly digest",
    desc: "A scheduled summary of my watched regions, rates, and market changes.",
  },
];

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Alerts</h1>
        <p className="text-sm text-slate-500">
          Configurable rules delivered by email and phone push (PWA). Rule engine and
          delivery land in Phase 1d — this is the planned surface.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {alertTypes.map((a) => (
          <div key={a.title} className="card flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold">{a.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{a.desc}</p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800">
              Planned
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
