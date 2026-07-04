/**
 * Server-side: project the US states topojson into SVG path strings once (module-cached).
 * The client map receives only the ready-made paths, so d3-geo and the topojson never ship
 * to the browser.
 */
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import { US_STATES } from "@/lib/geo/states";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import topo from "@/lib/geo/us-states-10m.json";

const VIEW_W = 975;
const VIEW_H = 610;

const fipsToAbbr = new Map(US_STATES.map((s) => [s.fips, s.abbr]));

export interface StatePath {
  fips: string;
  stateCode: string | undefined;
  name: string;
  d: string;
}

function build(): { paths: StatePath[]; width: number; height: number } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = topo as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fc = feature(t, t.objects.states) as any;
  const projection = geoAlbersUsa().fitSize([VIEW_W, VIEW_H], fc);
  const path = geoPath(projection);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paths: StatePath[] = fc.features.map((f: any) => {
    const fips = String(f.id).padStart(2, "0");
    return { fips, stateCode: fipsToAbbr.get(fips), name: f.properties?.name ?? fips, d: path(f) ?? "" };
  });
  return { paths, width: VIEW_W, height: VIEW_H };
}

let cached: ReturnType<typeof build> | undefined;

export function statePaths() {
  if (!cached) cached = build();
  return cached;
}
