import { PageHeader, Card, EmptyNote } from "@/components/ui";
import { statesList, latestMortgageRate, dbConfigured } from "@/lib/queries";
import { fetchLiveListings, REDFIN_STATE_REGION_IDS } from "@/lib/sources/redfin-live";
import { maxAffordablePrice, GUIDELINES } from "@/lib/affordability";
import { getProfile } from "@/lib/profile";
import { usd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{
    state?: string;
    budget?: string;
    beds?: string;
    baths?: string;
    stories?: string;
    basement?: string;
  }>;
}) {
  const { state: stateParam, budget: budgetParam, beds, baths, stories, basement } = await searchParams;
  const [states, rateRow, profile] = await Promise.all([
    statesList(),
    latestMortgageRate("30yr"),
    getProfile(),
  ]);
  const rate = rateRow?.rate ?? 6.8;

  // Default budget: what this household comfortably affords at today's rate.
  const comfortable = maxAffordablePrice({
    grossAnnualIncome: profile.income,
    monthlyDebts: profile.monthlyDebts,
    downPayment: { kind: "percent", percent: profile.downPct },
    annualRatePct: rate,
    guideline: GUIDELINES.conventional_classic,
  }).maxHomePrice;
  const budget = Math.round(Number(budgetParam) > 0 ? Number(budgetParam) : comfortable);

  const usable = states.filter((s) => REDFIN_STATE_REGION_IDS[s.name]);
  const selectedName = usable.some((s) => s.name === stateParam) ? stateParam! : usable[0]?.name;

  const minBeds = Math.max(0, Number(beds) || 0);
  const minBaths = Math.max(0, Number(baths) || 0);
  const minStories = Math.max(0, Number(stories) || 0);
  const wantBasement = basement === "1";

  const listings = selectedName
    ? await fetchLiveListings({
        stateName: selectedName,
        maxPrice: budget,
        minBeds: minBeds || undefined,
        minBaths: minBaths || undefined,
        minStories: minStories || undefined,
        basement: wantBasement,
      })
    : [];
  const filterSummary = [
    minBeds ? `${minBeds}+ bd` : null,
    minBaths ? `${minBaths}+ ba` : null,
    minStories > 1 ? `${minStories}+ stories` : null,
    wantBasement ? "basement" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Deals"
        subtitle={`Actual homes on the market right now at or under your budget, straight from the MLS feed. Budget defaults to what you comfortably afford (${usd(comfortable)} at ${rate.toFixed(2)}%).`}
      />

      {!dbConfigured() || usable.length === 0 ? (
        <EmptyNote>No geographies seeded yet. Run <code>npm run seed:geo</code> first.</EmptyNote>
      ) : (
        <>
          <form className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="label">State</span>
              <select name="state" defaultValue={selectedName} className="input min-w-[10rem]">
                {usable.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Max price</span>
              <input
                type="number"
                name="budget"
                defaultValue={budget}
                step={10000}
                min={0}
                className="input max-w-[11rem]"
              />
            </label>
            <label className="block">
              <span className="label">Beds</span>
              <input type="number" name="beds" defaultValue={minBeds || ""} placeholder="any" min={0} max={10} className="input w-20" />
            </label>
            <label className="block">
              <span className="label">Baths</span>
              <input type="number" name="baths" defaultValue={minBaths || ""} placeholder="any" min={0} max={10} className="input w-20" />
            </label>
            <label className="block">
              <span className="label">Stories</span>
              <input type="number" name="stories" defaultValue={minStories || ""} placeholder="any" min={0} max={4} className="input w-20" />
            </label>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" name="basement" value="1" defaultChecked={wantBasement} className="accent-[var(--brand)]" />
              Basement
            </label>
            <button className="btn">Search</button>
          </form>

          {listings.length === 0 ? (
            <EmptyNote>
              No live listings came back for {selectedName} under {usd(budget)}. Either nothing
              matches, or the unofficial listing feed is unavailable right now; try again in a
              few minutes.
            </EmptyNote>
          ) : (
            <Card>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">
                  {listings.length}
                  {listings.length >= 350 ? "+" : ""} homes under {usd(budget)}
                  {filterSummary ? ` (${filterSummary})` : ""} in {selectedName}
                </h2>
                <span className="text-xs text-[var(--muted)]">cheapest first; sample of up to 350</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[var(--muted)]">
                      <th className="py-1 pr-4 font-medium">Price</th>
                      <th className="py-1 pr-4 font-medium">Address</th>
                      <th className="py-1 pr-4 font-medium">City</th>
                      <th className="py-1 pr-4 font-medium">Beds</th>
                      <th className="py-1 pr-4 font-medium">Baths</th>
                      <th className="py-1 pr-4 font-medium">Sq ft</th>
                      <th className="py-1 pr-4 font-medium">Days listed</th>
                      <th className="py-1 font-medium">Listing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listings.slice(0, 100).map((l, i) => (
                      <tr key={`${l.url}-${i}`} className="border-t border-[var(--border)]">
                        <td className="py-1.5 pr-4 font-medium tabular-nums">{usd(l.price)}</td>
                        <td className="py-1.5 pr-4">{l.address || "(address withheld)"}</td>
                        <td className="py-1.5 pr-4">{l.city}</td>
                        <td className="py-1.5 pr-4 tabular-nums">{l.beds ?? ""}</td>
                        <td className="py-1.5 pr-4 tabular-nums">{l.baths ?? ""}</td>
                        <td className="py-1.5 pr-4 tabular-nums">{l.sqft ? l.sqft.toLocaleString() : ""}</td>
                        <td className="py-1.5 pr-4 tabular-nums">{l.daysOnMarket ?? ""}</td>
                        <td className="py-1.5">
                          {l.url && (
                            <a
                              href={l.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-[var(--brand)] underline"
                            >
                              View
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <p className="text-xs text-[var(--muted)]">
            Experimental: uses Redfin&apos;s unofficial listing export, refreshed at most every 15
            minutes. Listing data belongs to the originating MLS; always verify on the listing
            page. Garage/parking can&apos;t be filtered through this feed, so check listings for
            it. Want an email when a match appears? Save these filters as an alert on the
            Alerts page. If this page stops returning homes, the endpoint has likely changed.
          </p>
        </>
      )}
    </div>
  );
}
