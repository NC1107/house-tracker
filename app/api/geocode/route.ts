import { NextResponse } from "next/server";

/**
 * Geocode a US address via the Census Bureau's free geocoder (no key, government-run).
 * Used by the profile popup to turn a work address into coordinates for the
 * distance-to-work feature. Proxied server-side to avoid browser CORS issues.
 */
export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address")?.trim() ?? "";
  if (address.length < 5) {
    return NextResponse.json({ ok: false, reason: "address too short" }, { status: 400 });
  }
  try {
    const url =
      "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?" +
      new URLSearchParams({ address, benchmark: "Public_AR_Current", format: "json" });
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), next: { revalidate: 86_400 } });
    if (!res.ok) return NextResponse.json({ ok: false, reason: `geocoder ${res.status}` }, { status: 502 });
    const data = (await res.json()) as {
      result?: { addressMatches?: { coordinates?: { x?: number; y?: number }; matchedAddress?: string }[] };
    };
    const m = data.result?.addressMatches?.[0];
    if (!m?.coordinates || !Number.isFinite(m.coordinates.x) || !Number.isFinite(m.coordinates.y)) {
      return NextResponse.json({ ok: false, reason: "no match" });
    }
    return NextResponse.json({
      ok: true,
      lat: m.coordinates.y,
      lng: m.coordinates.x,
      matched: m.matchedAddress ?? address,
    });
  } catch {
    return NextResponse.json({ ok: false, reason: "geocoder unavailable" }, { status: 502 });
  }
}
