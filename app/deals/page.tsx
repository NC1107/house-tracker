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
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">
                  {listings.length}
                  {listings.length >= 350 ? "+" : ""} homes under {usd(budget)}
                  {filterSummary ? ` (${filterSummary})` : ""} in {selectedName}
                </h2>
                <span className="text-xs text-[var(--muted)]">cheapest first; showing {Math.min(listings.length, 30)} of a sample of up to 350</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {listings.slice(0, 30).map((l, i) => (
                  <a
                    key={`${l.url}-${i}`}
                    href={l.url || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="card group overflow-hidden !p-0 transition-shadow hover:shadow-lg"
                  >
                    <div className="relative aspect-[3/2] w-full overflow-hidden bg-[var(--surface-2)]">
                      {l.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={l.photoUrl}
                          alt={l.address ? `Photo of ${l.address}` : "Listing photo"}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-sm text-[var(--muted)]">
                          No photo
                        </div>
                      )}
                      {l.daysOnMarket !== null && l.daysOnMarket <= 3 && (
                        <span className="absolute left-2 top-2 rounded-full bg-[var(--brand)] px-2 py-0.5 text-xs font-medium text-white">
                          New
                        </span>
                      )}
                      <span className="absolute bottom-2 left-2 rounded-lg bg-black/65 px-2 py-1 text-base font-bold tabular-nums text-white">
                        {usd(l.price)}
                      </span>
                    </div>
                    <div className="space-y-1 p-3">
                      <p className="text-sm text-[var(--text-2)]">
                        <span className="font-medium text-[var(--text-1)]">{l.beds ?? "?"} bd</span>
                        {" · "}
                        <span className="font-medium text-[var(--text-1)]">{l.baths ?? "?"} ba</span>
                        {l.sqft ? (
                          <>
                            {" · "}
                            <span className="font-medium text-[var(--text-1)]">{l.sqft.toLocaleString()}</span> sqft
                          </>
                        ) : null}
                        {l.pricePerSqft ? ` · $${Math.round(l.pricePerSqft)}/sqft` : ""}
                      </p>
                      <p className="truncate text-sm font-medium">{l.address || "Address withheld"}</p>
                      <p className="truncate text-xs text-[var(--muted)]">
                        {l.city}, {l.state} {l.zip}
                        {l.yearBuilt ? ` · built ${l.yearBuilt}` : ""}
                        {l.daysOnMarket ? ` · ${l.daysOnMarket} day${l.daysOnMarket === 1 ? "" : "s"} listed` : ""}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </>
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
