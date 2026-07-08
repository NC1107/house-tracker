/**
 * Address-suggestion parsing for the work-address autocomplete. The source is
 * Photon (komoot's OSM geocoder: free, no key, built for search-as-you-type);
 * the network call lives in app/api/geocode/suggest. Suggestions carry their
 * own coordinates, so picking one needs no follow-up geocoding.
 */

export interface AddressSuggestion {
  label: string;
  lat: number;
  lng: number;
}

interface PhotonProperties {
  countrycode?: string;
  name?: string;
  housenumber?: string;
  street?: string;
  city?: string;
  district?: string;
  county?: string;
  state?: string;
  postcode?: string;
}

interface PhotonFeature {
  properties?: PhotonProperties;
  geometry?: { coordinates?: unknown[] };
}

/** One-line display label: "name, 123 Main Street, Dundalk, Maryland 21222". */
export function formatSuggestionLabel(p: PhotonProperties): string {
  const street = p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street;
  const cityAndState = [p.city ?? p.district ?? p.county, p.state].filter(Boolean).join(", ");
  const tail = [cityAndState, p.postcode].filter(Boolean).join(" ");
  const parts = [p.name, street, tail].filter(Boolean) as string[];
  // A plain address result repeats the street as its name; drop the duplicate.
  return parts.filter((part, i) => parts.indexOf(part) === i).join(", ");
}

/** Parse a Photon FeatureCollection into US suggestions, deduped, capped at `limit`. */
export function parsePhotonSuggestions(data: unknown, limit = 6): AddressSuggestion[] {
  const features = (data as { features?: PhotonFeature[] })?.features;
  if (!Array.isArray(features)) return [];
  const out: AddressSuggestion[] = [];
  const seen = new Set<string>();
  for (const f of features) {
    const p = f.properties;
    if (!p || p.countrycode !== "US") continue;
    const [lng, lat] = f.geometry?.coordinates ?? [];
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const label = formatSuggestionLabel(p);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push({ label, lat, lng });
    if (out.length >= limit) break;
  }
  return out;
}
