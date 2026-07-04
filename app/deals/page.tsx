import Image from "next/image";
import { PageHeader, EmptyNote } from "@/components/ui";
import { statesList, latestMortgageRate, dbConfigured } from "@/lib/queries";
import { fetchLiveListings, fetchStateCities, REDFIN_STATE_REGION_IDS } from "@/lib/sources/redfin-live";
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
    minprice?: string;
    beds?: string;
    baths?: string;
    stories?: string;
    basement?: string;
    sqft?: string;
    yearmin?: string;
    yearmax?: string;
    lot?: string;
    type?: string;
    city?: string;
  }>;
}) {
  const sp = await searchParams;
  const { state: stateParam, budget: budgetParam, beds, baths, stories, basement } = sp;
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

  // City scoping: known big cities search Redfin's city region directly; anything else
  // typed falls back to filtering the state results by city name.
  const cities = selectedName ? await fetchStateCities(selectedName) : [];
  const cityQuery = (sp.city ?? "").trim();
  const cityMatch = cityQuery
    ? cities.find((c) => c.name.toLowerCase() === cityQuery.toLowerCase())
    : undefined;

  const minBeds = Math.max(0, Number(beds) || 0);
  const minBaths = Math.max(0, Number(baths) || 0);
  const minStories = Math.max(0, Number(stories) || 0);
  const wantBasement = basement === "1";
  // Default price floor: $1 "auction teaser" listings are indistinguishable in the data,
  // so a Zillow-style minimum price (editable, 0 to disable) keeps them out.
  const minPrice = sp.minprice === undefined ? 10_000 : Math.max(0, Number(sp.minprice) || 0);
  const minSqft = Math.max(0, Number(sp.sqft) || 0);
  const yearMin = Math.max(0, Number(sp.yearmin) || 0);
  const yearMax = Math.max(0, Number(sp.yearmax) || 0);
  const lotAcres = Math.max(0, Number(sp.lot) || 0);
  const houseType = ["house", "condo", "townhouse", "multifamily"].includes(sp.type ?? "")
    ? (sp.type as "house" | "condo" | "townhouse" | "multifamily")
    : undefined;

  const listings = selectedName
    ? await fetchLiveListings({
        stateName: selectedName,
        maxPrice: budget,
        minPrice: minPrice || undefined,
        minBeds: minBeds || undefined,
        minBaths: minBaths || undefined,
        minStories: minStories || undefined,
        minSqft: minSqft || undefined,
        minYearBuilt: yearMin || undefined,
        maxYearBuilt: yearMax || undefined,
        minLotSqft: lotAcres ? Math.round(lotAcres * 43_560) : undefined,
        basement: wantBasement,
        types: houseType ? [houseType] : undefined,
        cityRegionId: cityMatch?.id,
        cityName: cityMatch ? undefined : cityQuery || undefined,
      })
    : [];
  const filterSummary = [
    minBeds ? `${minBeds}+ bd` : null,
    minBaths ? `${minBaths}+ ba` : null,
    minStories > 1 ? `${minStories}+ stories` : null,
    minSqft ? `${minSqft.toLocaleString()}+ sqft` : null,
    yearMin || yearMax ? `built ${yearMin || "..."}-${yearMax || "now"}` : null,
    lotAcres ? `${lotAcres}+ acres` : null,
    wantBasement ? "basement" : null,
    houseType ?? null,
    cityQuery ? `in ${cityMatch?.name ?? cityQuery}` : null,
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
          <form className="card space-y-3">
            <div className="flex flex-wrap items-end gap-3">
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
                <span className="label">City (optional)</span>
                <input
                  type="text"
                  name="city"
                  defaultValue={cityQuery}
                  placeholder="anywhere"
                  list="city-options"
                  className="input w-40"
                />
                <datalist id="city-options">
                  {cities.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </label>
              <label className="block">
                <span className="label">Min price</span>
                <input type="number" name="minprice" defaultValue={minPrice || ""} placeholder="0" step={5000} min={0} className="input w-28" />
              </label>
              <label className="block">
                <span className="label">Max price</span>
                <input type="number" name="budget" defaultValue={budget} step={10000} min={0} className="input w-32" />
              </label>
              <label className="block">
                <span className="label">Type</span>
                <select name="type" defaultValue={houseType ?? ""} className="input">
                  <option value="">Any</option>
                  <option value="house">House</option>
                  <option value="condo">Condo</option>
                  <option value="townhouse">Townhouse</option>
                  <option value="multifamily">Multi-family</option>
                </select>
              </label>
              <label className="block">
                <span className="label">Beds</span>
                <input type="number" name="beds" defaultValue={minBeds || ""} placeholder="any" min={0} max={10} className="input w-20" />
              </label>
              <label className="block">
                <span className="label">Baths</span>
                <input type="number" name="baths" defaultValue={minBaths || ""} placeholder="any" min={0} max={10} className="input w-20" />
              </label>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="label">Stories</span>
                <input type="number" name="stories" defaultValue={minStories || ""} placeholder="any" min={0} max={4} className="input w-20" />
              </label>
              <label className="block">
                <span className="label">Min sqft</span>
                <input type="number" name="sqft" defaultValue={minSqft || ""} placeholder="any" step={100} min={0} className="input w-24" />
              </label>
              <label className="block">
                <span className="label">Built after</span>
                <input type="number" name="yearmin" defaultValue={yearMin || ""} placeholder="any" min={1800} max={2030} className="input w-24" />
              </label>
              <label className="block">
                <span className="label">Built before</span>
                <input type="number" name="yearmax" defaultValue={yearMax || ""} placeholder="any" min={1800} max={2030} className="input w-24" />
              </label>
              <label className="block">
                <span className="label">Lot size</span>
                <select name="lot" defaultValue={lotAcres || ""} className="input">
                  <option value="">Any</option>
                  <option value="0.25">1/4+ acre</option>
                  <option value="0.5">1/2+ acre</option>
                  <option value="1">1+ acre</option>
                  <option value="2">2+ acres</option>
                  <option value="5">5+ acres</option>
                </select>
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input type="checkbox" name="basement" value="1" defaultChecked={wantBasement} className="accent-[var(--brand)]" />
                Basement
              </label>
              <button className="btn">Search</button>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Min price defaults to $10,000 to keep out $1 auction teasers; set it to 0 to include
              them. Garage/parking can&apos;t be filtered by the feed.
            </p>
          </form>

          {listings.length === 0 ? (
            <EmptyNote>
              No live listings came back for {cityQuery ? `${cityQuery}, ` : ""}
              {selectedName} under {usd(budget)}. Either nothing matches, or the unofficial
              listing feed is unavailable right now; try again in a few minutes.
              {cityQuery && !cityMatch
                ? " Small towns are matched by name against a statewide sample, so a big-city name from the suggestions works better."
                : ""}
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
                        <Image
                          src={l.photoUrl}
                          alt={l.address ? `Photo of ${l.address}` : "Listing photo"}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          referrerPolicy="no-referrer"
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
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
