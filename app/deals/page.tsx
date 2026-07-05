import { PageHeader, EmptyNote } from "@/components/ui";
import { statesList, latestMortgageRate, dbConfigured } from "@/lib/queries";
import { fetchLiveListings, fetchStateCities, REDFIN_STATE_REGION_IDS } from "@/lib/sources/redfin-live";
import AutoSubmitSelect from "@/components/AutoSubmitSelect";
import MoneyInput from "@/components/MoneyInput";
import RememberSearch from "@/components/RememberSearch";
import ListingCard from "@/components/ListingCard";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import { haversineMiles } from "@/lib/geo/distance";
import type { LiveListing } from "@/lib/sources/redfin-live";
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
    type?: string | string[];
    lt?: string | string[];
    city?: string;
    kw?: string;
    maxmiles?: string;
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
  // Default max price: comfortable budget, clamped to $1M so an extreme profile (e.g.
  // 100% down) can't produce a nonsense default. Typing a higher number still works.
  const budget = Math.round(Number(budgetParam) > 0 ? Number(budgetParam) : Math.min(comfortable, 1_000_000));

  const usable = states.filter((s) => REDFIN_STATE_REGION_IDS[s.name]);
  const fallbackState = usable.some((s) => s.name === profile.homeState) ? profile.homeState : usable[0]?.name;
  const selectedName = usable.some((s) => s.name === stateParam) ? stateParam! : fallbackState;

  // City scoping: known big cities search Redfin's city region directly; anything else
  // typed falls back to filtering the state results by city name.
  const cities = selectedName ? await fetchStateCities(selectedName) : [];
  // Multi-city: comma-separated input; defaults to ALL the profile's saved cities.
  const defaultCity =
    sp.city === undefined && selectedName === profile.homeState ? profile.homeCities.join(", ") : "";
  const cityQuery = (sp.city ?? defaultCity).trim();
  const cityNames = cityQuery
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 6);
  const cityTargets = cityNames.map((name) => ({
    name,
    match: cities.find((c) => c.name.toLowerCase() === name.toLowerCase()),
  }));

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
  const TYPE_KEYS = ["house", "condo", "townhouse", "multifamily", "land"] as const;
  const LT_KEYS = ["agent", "owner", "new"] as const;
  const asList = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);
  const pickedTypes = asList(sp.type).filter((t): t is (typeof TYPE_KEYS)[number] =>
    (TYPE_KEYS as readonly string[]).includes(t),
  );
  const pickedListingTypes = asList(sp.lt).filter((t): t is (typeof LT_KEYS)[number] =>
    (LT_KEYS as readonly string[]).includes(t),
  );

  const keyword = (sp.kw ?? "").trim();
  const maxMiles = Math.max(0, Number(sp.maxmiles) || 0);
  const hasWork = profile.workLat !== null && profile.workLng !== null;

  const baseFilters = {
    stateName: selectedName ?? "",
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
    types: pickedTypes.length ? pickedTypes : undefined,
    listingTypes: pickedListingTypes.length ? pickedListingTypes : undefined,
    keyword: keyword || undefined,
  };

  // One query per selected city (region-scoped when known, name-filtered otherwise),
  // merged, de-duplicated, and re-sorted by price; no cities = whole state.
  let listings: (LiveListing & { milesToWork?: number | null })[] = [];
  if (selectedName) {
    const perCity =
      cityTargets.length > 0
        ? await Promise.all(
            cityTargets.map((t) =>
              fetchLiveListings({
                ...baseFilters,
                cityRegionId: t.match?.id,
                cityName: t.match ? undefined : t.name,
              }),
            ),
          )
        : [await fetchLiveListings(baseFilters)];
    const seen = new Set<string>();
    listings = perCity
      .flat()
      .filter((l) => {
        const key = l.mls || l.url;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.price - b.price);
  }

  // Distance to work: annotate and optionally filter (straight-line miles).
  if (hasWork) {
    listings = listings.map((l) => ({
      ...l,
      milesToWork:
        l.lat !== null && l.lng !== null
          ? haversineMiles(l.lat, l.lng, profile.workLat!, profile.workLng!)
          : null,
    }));
    if (maxMiles > 0) {
      listings = listings.filter((l) => l.milesToWork != null && l.milesToWork <= maxMiles);
    }
  }
  const filterSummary = [
    minBeds ? `${minBeds}+ bd` : null,
    minBaths ? `${minBaths}+ ba` : null,
    minStories > 1 ? `${minStories}+ stories` : null,
    minSqft ? `${minSqft.toLocaleString()}+ sqft` : null,
    yearMin || yearMax ? `built ${yearMin || "..."}-${yearMax || "now"}` : null,
    lotAcres ? `${lotAcres}+ acres` : null,
    wantBasement ? "basement" : null,
    pickedTypes.length ? pickedTypes.join("/") : null,
    pickedListingTypes.length && pickedListingTypes.length < 3 ? pickedListingTypes.join("/") : null,
    keyword ? `"${keyword}"` : null,
    hasWork && maxMiles > 0 ? `within ${maxMiles} mi of work` : null,
    cityNames.length ? `in ${cityNames.join(" / ")}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-6">
      <RememberSearch storageKey="ht:deals:last-search" />
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
                <AutoSubmitSelect name="state" defaultValue={selectedName} className="input min-w-[10rem]">
                  {usable.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </AutoSubmitSelect>
              </label>
              <label className="block">
                <span className="label">Cities (comma-separated)</span>
                <input
                  type="text"
                  name="city"
                  defaultValue={cityQuery}
                  placeholder="anywhere"
                  list="city-options"
                  className="input w-52"
                />
                <datalist id="city-options">
                  {cities.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </label>
              <label className="block">
                <span className="label">Min price</span>
                <MoneyInput name="minprice" defaultValue={minPrice || ""} placeholder="0" className="input w-28" />
              </label>
              <label className="block">
                <span className="label">Max price</span>
                <MoneyInput name="budget" defaultValue={budget} className="input w-32" />
              </label>
              <div className="block">
                <span className="label">Home type</span>
                <MultiSelectDropdown
                  name="type"
                  options={[
                    { value: "house", label: "House" },
                    { value: "condo", label: "Condo" },
                    { value: "townhouse", label: "Townhouse" },
                    { value: "multifamily", label: "Multi-family" },
                    { value: "land", label: "Land" },
                  ]}
                  defaultSelected={pickedTypes}
                />
              </div>
              <label className="block">
                <span className="label">Beds (min)</span>
                <input type="number" name="beds" defaultValue={minBeds || ""} placeholder="any" min={0} max={10} className="input w-20" />
              </label>
              <label className="block">
                <span className="label">Baths (min)</span>
                <input type="number" name="baths" defaultValue={minBaths || ""} placeholder="any" min={0} max={10} className="input w-20" />
              </label>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="label">Stories (min)</span>
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
              <div className="block">
                <span className="label">Listed by</span>
                <MultiSelectDropdown
                  name="lt"
                  options={[
                    { value: "agent", label: "Agent" },
                    { value: "owner", label: "Owner (FSBO)" },
                    { value: "new", label: "New construction" },
                  ]}
                  defaultSelected={pickedListingTypes}
                />
              </div>
              <label className="block">
                <span className="label">Keyword</span>
                <input
                  type="text"
                  name="kw"
                  defaultValue={keyword}
                  placeholder="garage, pool..."
                  className="input w-36"
                />
              </label>
              {hasWork && (
                <label className="block">
                  <span className="label">Max miles to work</span>
                  <input type="number" name="maxmiles" defaultValue={maxMiles || ""} placeholder="any" min={0} className="input w-24" />
                </label>
              )}
              <button className="btn">Search</button>
            </div>
          </form>

          {listings.length === 0 ? (
            <EmptyNote>
              No live listings came back for {cityNames.length ? `${cityNames.join(", ")}, ` : ""}
              {selectedName} under {usd(budget)}. Either nothing matches, or the unofficial
              listing feed is unavailable right now; try again in a few minutes.
              {cityTargets.some((t) => !t.match)
                ? " Small towns are matched by name against a statewide sample, so big-city names from the suggestions work better."
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
                <span className="text-xs text-[var(--muted)]">Showing {Math.min(listings.length, 30)} of {listings.length}{listings.length >= 350 ? "+" : ""} · cheapest first</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {listings.slice(0, 30).map((l, i) => (
                  <ListingCard key={`${l.url}-${i}`} listing={l} />
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
