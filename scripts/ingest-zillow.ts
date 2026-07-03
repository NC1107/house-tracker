/**
 * Ingest Zillow ZHVI / ZORI bulk CSVs into metric_series (wide -> long).
 * Run: DATABASE_URL=... npm run ingest:zillow
 *
 * For large ZIP files this streams the whole file into memory then reshapes; fine for a
 * GitHub Action runner. If memory becomes an issue, filter dataRows to watched/seeded
 * geographies before reshaping.
 */
import { ZILLOW_FILES, downloadCsv } from "@/lib/sources/zillow";
import { parseCsv, wideToLong, upsertSeries, loadGeoIndex } from "@/lib/ingest";

async function main() {
  for (const file of ZILLOW_FILES) {
    console.log(`Downloading ${file.metricKey} @ ${file.level} ...`);
    const text = await downloadCsv(file.url);
    const rows = parseCsv(text);
    const [header, ...dataRows] = rows;
    if (!header) {
      console.warn(`Empty file for ${file.url}, skipping`);
      continue;
    }

    const geoIndex = await loadGeoIndex(file.level);
    const long = wideToLong(header, dataRows, {
      regionCodeCol: file.regionCodeCol,
      dateColStart: file.dateColStart,
      metricKey: file.metricKey,
      freq: file.freq,
      resolveGeoId: (code) => geoIndex.get(code),
    });

    const written = await upsertSeries(long);
    console.log(`  ${file.metricKey}/${file.level}: ${written} observations upserted`);
  }
  console.log("Zillow ingestion complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
