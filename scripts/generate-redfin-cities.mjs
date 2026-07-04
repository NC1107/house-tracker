/**
 * Regenerate lib/sources/redfin-cities.ts: the baked map of major-city Redfin region ids
 * per state, scraped from Redfin's state landing pages.
 *
 * Run occasionally (ids are stable): node scripts/generate-redfin-cities.mjs
 *
 * Uses curl rather than fetch on purpose: Redfin's HTML pages sit behind an AWS WAF
 * challenge that passes curl but rejects Node's HTTP stack. The app itself never scrapes
 * these pages at runtime; it reads the baked module.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware",
  "Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky",
  "Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi",
  "Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico",
  "New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania",
  "Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont",
  "Virginia","Washington","West Virginia","Wisconsin","Wyoming",
];
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const out = {};
for (const st of STATES) {
  const slug = st.replace(/ /g, "-");
  let html = "";
  try {
    html = execFileSync("curl", ["-sS", "-H", `User-Agent: ${UA}`, `https://www.redfin.com/state/${slug}`], {
      encoding: "utf-8",
      timeout: 40_000,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (e) {
    console.error(`${st}: fetch failed (${e.message}), keeping it out of the map`);
    continue;
  }
  const seen = new Map();
  for (const m of html.matchAll(/\/city\/(\d+)\/[A-Z]{2}\/([A-Za-z0-9-]+)/g)) {
    const name = m[2].replace(/-/g, " ");
    if (!seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), { id: Number(m[1]), name });
  }
  out[st] = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  console.log(`${st}: ${out[st].length} cities`);
  await new Promise((r) => setTimeout(r, 1200));
}

const total = Object.values(out).reduce((n, v) => n + v.length, 0);
const file = `/**
 * Major-city Redfin region ids (region_type 6) per state, scraped from Redfin's state
 * landing pages and baked in so the app never scrapes at runtime. ~25 biggest markets
 * per state; smaller towns fall back to client-side name filtering of state searches.
 * Regenerate with: node scripts/generate-redfin-cities.mjs (${total} cities)
 */
export interface CityRegion {
  id: number;
  name: string;
}

export const REDFIN_CITY_REGION_IDS: Record<string, CityRegion[]> = ${JSON.stringify(out, null, 0)};
`;
writeFileSync("lib/sources/redfin-cities.ts", file);
console.log(`Wrote lib/sources/redfin-cities.ts with ${total} cities`);
