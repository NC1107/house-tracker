/**
 * Canonical metric definitions. Ingestion scripts write metric_series rows keyed by these
 * metric_key values; the UI reads labels/units/categories from here. Seed into
 * metric_catalog via scripts/seed-geographies.ts (or a dedicated seed run).
 */
export interface MetricDef {
  metricKey: string;
  label: string;
  unit: "usd" | "percent" | "days" | "count" | "index" | "ratio" | "months";
  category: "price" | "rent" | "market" | "rate" | "income";
  source: "zillow" | "redfin" | "realtor" | "fred" | "census" | "hud";
  description?: string;
}

export const METRIC_CATALOG: MetricDef[] = [
  // Prices
  { metricKey: "zhvi_all", label: "Zillow Home Value Index", unit: "usd", category: "price", source: "zillow", description: "Typical home value (all homes, mid-tier, smoothed & seasonally adjusted)." },
  { metricKey: "median_sale_price", label: "Median Sale Price", unit: "usd", category: "price", source: "redfin" },
  { metricKey: "median_list_price", label: "Median List Price", unit: "usd", category: "price", source: "realtor" },
  { metricKey: "case_shiller_national", label: "Case-Shiller National HPI", unit: "index", category: "price", source: "fred" },
  { metricKey: "fhfa_hpi", label: "FHFA House Price Index", unit: "index", category: "price", source: "fred" },
  { metricKey: "zhvf_forecast", label: "Zillow Home Value Forecast (1yr)", unit: "percent", category: "price", source: "zillow" },

  // Rent
  { metricKey: "zori", label: "Zillow Observed Rent Index", unit: "usd", category: "rent", source: "zillow" },

  // Market heat
  { metricKey: "days_on_market", label: "Median Days on Market", unit: "days", category: "market", source: "redfin" },
  { metricKey: "inventory", label: "Active Inventory", unit: "count", category: "market", source: "redfin" },
  { metricKey: "new_listings", label: "New Listings", unit: "count", category: "market", source: "redfin" },
  { metricKey: "realtor_new_listings", label: "New Listings (Realtor.com)", unit: "count", category: "market", source: "realtor", description: "Own key so Redfin's new-listings series (different methodology) is never mixed into it." },
  { metricKey: "months_of_supply", label: "Months of Supply", unit: "months", category: "market", source: "redfin" },
  { metricKey: "sale_to_list", label: "Sale-to-List Ratio", unit: "ratio", category: "market", source: "redfin" },
  { metricKey: "price_drops_share", label: "Share of Listings with Price Drops", unit: "percent", category: "market", source: "redfin" },
  { metricKey: "pending_ratio", label: "Pending-to-Active Ratio", unit: "ratio", category: "market", source: "realtor", description: "Pending sales relative to active listings; higher means demand is absorbing supply faster." },
  { metricKey: "housing_starts", label: "Housing Starts", unit: "count", category: "market", source: "fred", description: "HOUST, new privately-owned housing units started (SAAR, thousands)." },
  { metricKey: "building_permits", label: "Building Permits", unit: "count", category: "market", source: "fred", description: "PERMIT, new privately-owned housing units authorized (SAAR, thousands)." },

  // Rates
  { metricKey: "mortgage_30yr", label: "30-Year Fixed Mortgage Rate", unit: "percent", category: "rate", source: "fred" },
  { metricKey: "mortgage_30yr_daily", label: "30-Year Fixed Rate (daily)", unit: "percent", category: "rate", source: "fred", description: "Optimal Blue OBMMIC30YF — daily granularity for short timespans." },
  { metricKey: "mortgage_15yr", label: "15-Year Fixed Mortgage Rate", unit: "percent", category: "rate", source: "fred" },
  { metricKey: "treasury_10yr", label: "10-Year Treasury Yield", unit: "percent", category: "rate", source: "fred" },

  // Income / affordability inputs
  { metricKey: "median_sale_price_us", label: "US Median Sale Price", unit: "usd", category: "price", source: "fred", description: "Median sales price of houses sold (MSPUS), quarterly." },
  { metricKey: "cpi", label: "Consumer Price Index", unit: "index", category: "price", source: "fred", description: "CPIAUCSL — for inflation-adjusting prices." },
  { metricKey: "months_supply_new", label: "Monthly Supply of New Homes", unit: "months", category: "market", source: "fred", description: "MSACSR — how many months to sell current for-sale inventory." },
  { metricKey: "real_median_income", label: "Real Median Household Income", unit: "usd", category: "income", source: "fred", description: "MEHOINUSA672N (constant dollars), annual." },
  { metricKey: "nominal_median_income", label: "Median Household Income (nominal)", unit: "usd", category: "income", source: "fred", description: "MEHOINUSA646N (current dollars) — use for price-to-income so both sides are nominal." },
  { metricKey: "median_household_income", label: "Median Household Income", unit: "usd", category: "income", source: "census" },
  { metricKey: "median_home_value_acs", label: "Median Home Value (ACS)", unit: "usd", category: "income", source: "census" },
  { metricKey: "effective_property_tax_rate", label: "Effective Property Tax Rate", unit: "percent", category: "income", source: "census", description: "Median real-estate taxes / median home value (annual)." },
];

/** FRED series id -> our metric_key, for the national/rate ingestion. */
export const FRED_SERIES: { seriesId: string; metricKey: string; freq: import("@/lib/types").MetricFreq }[] = [
  { seriesId: "MORTGAGE30US", metricKey: "mortgage_30yr", freq: "weekly" },
  { seriesId: "MORTGAGE15US", metricKey: "mortgage_15yr", freq: "weekly" },
  { seriesId: "DGS10", metricKey: "treasury_10yr", freq: "daily" },
  { seriesId: "CSUSHPINSA", metricKey: "case_shiller_national", freq: "monthly" },
  { seriesId: "MSPUS", metricKey: "median_sale_price_us", freq: "quarterly" },
  { seriesId: "MEHOINUSA672N", metricKey: "real_median_income", freq: "annual" },
  { seriesId: "MEHOINUSA646N", metricKey: "nominal_median_income", freq: "annual" },
  { seriesId: "CPIAUCSL", metricKey: "cpi", freq: "monthly" },
  { seriesId: "MSACSR", metricKey: "months_supply_new", freq: "monthly" },
  { seriesId: "OBMMIC30YF", metricKey: "mortgage_30yr_daily", freq: "daily" },
  { seriesId: "HOUST", metricKey: "housing_starts", freq: "monthly" },
  { seriesId: "PERMIT", metricKey: "building_permits", freq: "monthly" },
];
