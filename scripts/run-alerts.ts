/**
 * Daily alert evaluator (single-user). Loads enabled rules, evaluates each against the
 * latest data, de-dupes via alert_events, and emails any that fired via Resend.
 * Run: DATABASE_URL=... RESEND_API_KEY=... ALERT_EMAIL=... npm run alerts:run
 */
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { alertRules, alertEvents, geographies } from "@/db/schema";
import { latestMortgageRate, latestMetric, metricYoY } from "@/lib/queries";
import { marketHeat } from "@/lib/marketheat";
import { evaluateAlert, type AlertRule, type AlertEvaluation, type MatchedListing } from "@/lib/alerts";
import { fetchLiveListings, type ListingFilters } from "@/lib/sources/redfin-live";
import { sendEmail } from "@/lib/notify";

async function main() {
  const db = getDb();
  const rules = await db.select().from(alertRules).where(eq(alertRules.enabled, true));
  if (rules.length === 0) {
    console.log("No enabled alert rules.");
    process.exit(0);
  }

  // Region names for messages.
  const geoIds = [...new Set(rules.map((r) => (r.params as Record<string, unknown>).geographyId).filter(Boolean))] as number[];
  const geos = geoIds.length
    ? await db.select({ id: geographies.id, name: geographies.name }).from(geographies).where(inArray(geographies.id, geoIds))
    : [];
  const geoName = new Map(geos.map((g) => [g.id, g.name]));

  const rate = await latestMortgageRate("30yr");

  const fired: { rule: typeof rules[number]; ev: AlertEvaluation }[] = [];

  for (const rule of rules) {
    const p = rule.params as Record<string, unknown>;
    const gid = p.geographyId as number | undefined;
    const ar: AlertRule = { id: rule.id, type: rule.type as AlertRule["type"], params: p, regionName: gid ? geoName.get(gid) : undefined };

    let ev: AlertEvaluation = { fired: false };
    if (rule.type === "rate_threshold") {
      ev = evaluateAlert(ar, { rate: rate?.rate ?? null, date: rate?.date ?? null });
    } else if (rule.type === "market_heat" && gid) {
      const [mos, dom, drops, s2l, invTrend] = await Promise.all([
        latestMetric(gid, "months_of_supply"),
        latestMetric(gid, "days_on_market"),
        latestMetric(gid, "price_drops_share"),
        latestMetric(gid, "sale_to_list"),
        metricYoY(gid, "inventory"),
      ]);
      const heat = marketHeat({
        monthsOfSupply: mos?.value,
        daysOnMarket: dom?.value,
        priceDropsShare: drops?.value,
        saleToList: s2l?.value,
        inventoryTrendYoY: invTrend ?? undefined,
      });
      ev = evaluateAlert(ar, { score: heat.score, date: mos?.date ?? null });
    } else if (rule.type === "price_move" && gid) {
      const yoy = await metricYoY(gid, "zhvi_all");
      const latest = await latestMetric(gid, "zhvi_all");
      ev = evaluateAlert(ar, { yoyPct: yoy == null ? null : yoy * 100, date: latest?.date ?? null });
    } else if (rule.type === "listing_match") {
      // Saved search: fetch matching live listings, keep only ones never seen for this
      // rule (one alert_events row per listing), and notify about the new ones.
      const filters = p as ListingFilters & { stateName?: string };
      const listings = await fetchLiveListings({
        stateName: String(filters.stateName ?? ""),
        minPrice: Number(filters.minPrice) || undefined,
        maxPrice: Number(filters.maxPrice) || undefined,
        minBeds: Number(filters.minBeds) || undefined,
        minBaths: Number(filters.minBaths) || undefined,
        minStories: Number(filters.minStories) || undefined,
        minSqft: Number(filters.minSqft) || undefined,
        minYearBuilt: Number(filters.minYearBuilt) || undefined,
        basement: Boolean(filters.basement),
      });
      const keyOf = (l: { mls: string; url: string }) => `mls:${l.mls || l.url}`.slice(0, 128);
      const keys = listings.map(keyOf);
      const seen = keys.length
        ? await db
            .select({ dedupeKey: alertEvents.dedupeKey })
            .from(alertEvents)
            .where(and(eq(alertEvents.ruleId, rule.id), inArray(alertEvents.dedupeKey, keys)))
        : [];
      const seenSet = new Set(seen.map((s) => s.dedupeKey));
      const fresh: MatchedListing[] = listings
        .filter((l) => !seenSet.has(keyOf(l)))
        .map((l) => ({ address: l.address, city: l.city, price: l.price, url: l.url, mls: l.mls }));
      // First run seeds the baseline silently so adding a rule doesn't email 350 homes.
      const isFirstRun = seen.length === 0 && fresh.length === listings.length && listings.length > 0;
      for (const l of fresh) {
        await db
          .insert(alertEvents)
          .values({ ruleId: rule.id, dedupeKey: keyOf(l), payload: { price: l.price, url: l.url } })
          .onConflictDoNothing();
      }
      if (!isFirstRun) {
        ev = evaluateAlert(ar, { newListings: fresh, date: new Date().toISOString().slice(0, 10) });
        if (ev.fired) fired.push({ rule, ev });
      } else {
        console.log(`listing_match #${rule.id}: seeded baseline of ${fresh.length} current listings`);
      }
      continue; // per-listing dedupe already handled; skip the generic block
    }

    if (ev.fired && ev.dedupeKey) {
      // Skip if we've already fired this exact condition.
      const existing = await db
        .select({ id: alertEvents.id })
        .from(alertEvents)
        .where(and(eq(alertEvents.ruleId, rule.id), eq(alertEvents.dedupeKey, ev.dedupeKey)))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(alertEvents).values({ ruleId: rule.id, dedupeKey: ev.dedupeKey, payload: { message: ev.message } });
        fired.push({ rule, ev });
      }
    }
  }

  if (fired.length === 0) {
    console.log(`Evaluated ${rules.length} rules — nothing new to notify.`);
    process.exit(0);
  }

  const html = `<h2>House Tracker alerts</h2><ul>${fired.map((f) => `<li>${f.ev.message}</li>`).join("")}</ul>`;
  const res = await sendEmail(`House Tracker: ${fired.length} alert${fired.length > 1 ? "s" : ""}`, html);
  console.log(`Fired ${fired.length}; email ${res.sent ? "sent" : "skipped (" + res.reason + ")"}.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
