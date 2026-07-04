"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { alertRules } from "@/db/schema";
import { ensureOwnerId } from "@/lib/owner";
import { sendEmail } from "@/lib/notify";
import { fetchStateCities } from "@/lib/sources/redfin-live";

function num(v: FormDataEntryValue | null, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function createAlert(formData: FormData) {
  const type = String(formData.get("type") || "");
  const geographyId = formData.get("geographyId") ? Number(formData.get("geographyId")) : undefined;

  let params: Record<string, unknown> = {};
  if (type === "rate_threshold") {
    params = { product: "30yr", below: num(formData.get("below"), 6) };
  } else if (type === "market_heat") {
    params = { geographyId, minScore: num(formData.get("minScore"), 60) };
  } else if (type === "price_move") {
    params = { geographyId, pctThreshold: num(formData.get("pctThreshold"), 3), direction: String(formData.get("direction") || "down") };
  } else if (type === "listing_match") {
    params = {
      stateName: String(formData.get("stateName") || ""),
      minPrice: num(formData.get("minPrice"), 10_000),
      maxPrice: num(formData.get("maxPrice"), 400_000),
      minBeds: num(formData.get("minBeds"), 0),
      minBaths: num(formData.get("minBaths"), 0),
      minStories: num(formData.get("minStories"), 0),
      minSqft: num(formData.get("minSqft"), 0),
      minYearBuilt: num(formData.get("minYearBuilt"), 0),
      basement: formData.get("basement") === "1",
    };
    if (!params.stateName) return;
    // Resolve the city to a Redfin region id now, so the daily runner queries the city
    // directly; unresolved names fall back to name-filtering the state results.
    const cityName = String(formData.get("cityName") || "").trim();
    if (cityName) {
      const match = (await fetchStateCities(String(params.stateName))).find(
        (c) => c.name.toLowerCase() === cityName.toLowerCase(),
      );
      params.cityName = match?.name ?? cityName;
      if (match) params.cityRegionId = match.id;
    }
  } else {
    return;
  }

  const db = getDb();
  const userId = await ensureOwnerId();
  await db.insert(alertRules).values({ userId, type, params, channels: ["email"], enabled: true });
  revalidatePath("/alerts");
}

export async function deleteAlert(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  const db = getDb();
  await db.delete(alertRules).where(eq(alertRules.id, id));
  revalidatePath("/alerts");
}

export async function sendTest() {
  const r = await sendEmail(
    "House Tracker test alert",
    "<p>This is a test alert from House Tracker. If you received this, email notifications are working.</p>",
  );
  redirect(`/alerts?test=${r.sent ? "sent" : "fail"}`);
}
