/**
 * FHFA House Price Index, state-level, all-transactions, quarterly since 1975. Free CSV,
 * no key. The file has NO header row; columns are: state abbr, year, quarter, index.
 * The long government-grade history complements Zillow's ZHVI (which starts in 2000).
 */

export const FHFA_STATE_HPI_URL = "https://www.fhfa.gov/hpi/download/quarterly_datasets/hpi_at_state.csv";

/** (year, quarter) -> quarter-end date "YYYY-MM-DD"; null for invalid quarters. */
export function quarterEndDate(year: number, quarter: number): string | null {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) return null;
  const ends: Record<number, string> = { 1: "03-31", 2: "06-30", 3: "09-30", 4: "12-31" };
  const end = ends[quarter];
  return end ? `${year}-${end}` : null;
}
