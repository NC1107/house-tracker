import { NextResponse } from "next/server";
import { parsePhotonSuggestions } from "@/lib/geo/suggest";

/**
 * Address suggestions for the work-address autocomplete, via Photon (komoot's
 * OSM geocoder: free, no key). Proxied server-side like /api/geocode so the
 * browser never talks to a third party, and callers degrade gracefully when
 * the service is slow or down.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) {
    return NextResponse.json({ ok: true, suggestions: [] });
  }
  try {
    // Fetch more than we show: the US filter in the parser discards foreign hits.
    const url = "https://photon.komoot.io/api/?" + new URLSearchParams({ q, limit: "10", lang: "en" });
    const res = await fetch(url, { signal: AbortSignal.timeout(6_000), cache: "no-store" });
    if (!res.ok) return NextResponse.json({ ok: false, suggestions: [] }, { status: 502 });
    return NextResponse.json({ ok: true, suggestions: parsePhotonSuggestions(await res.json(), 6) });
  } catch {
    return NextResponse.json({ ok: false, suggestions: [] }, { status: 502 });
  }
}
