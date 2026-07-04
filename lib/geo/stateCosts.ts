/**
 * Per-state effective property-tax rates and rough homeowners-insurance rates (annual, as a
 * fraction of home value). Property tax varies from ~0.3% (HI) to ~2.5% (NJ) and is the
 * biggest per-state cost driver, so using a flat national rate materially flatters
 * high-tax states. Insurance rates are approximate estimates (storm/wildfire exposure
 * pushes FL/LA/OK far above the ~0.5% national norm) and should be read as ballpark.
 *
 * Property tax ≈ Tax Foundation effective-rate estimates. Insurance ≈ public state-average
 * premium-to-value estimates. Both are national reference figures, not a quote.
 */

/** Effective annual property-tax rate by state (fraction of home value). */
export const STATE_PROPERTY_TAX: Record<string, number> = {
  AL: 0.0041, AK: 0.0119, AZ: 0.0063, AR: 0.0062, CA: 0.0075, CO: 0.0055, CT: 0.0215,
  DE: 0.0058, DC: 0.0057, FL: 0.0091, GA: 0.0092, HI: 0.0032, ID: 0.0067, IL: 0.0223,
  IN: 0.0084, IA: 0.0157, KS: 0.0143, KY: 0.0085, LA: 0.0056, ME: 0.0124, MD: 0.0107,
  MA: 0.0120, MI: 0.0148, MN: 0.0111, MS: 0.0079, MO: 0.0098, MT: 0.0083, NE: 0.0167,
  NV: 0.0059, NH: 0.0209, NJ: 0.0247, NM: 0.0080, NY: 0.0173, NC: 0.0082, ND: 0.0100,
  OH: 0.0159, OK: 0.0090, OR: 0.0093, PA: 0.0153, RI: 0.0163, SC: 0.0057, SD: 0.0117,
  TN: 0.0071, TX: 0.0168, UT: 0.0063, VT: 0.0190, VA: 0.0087, WA: 0.0098, WV: 0.0059,
  WI: 0.0173, WY: 0.0061,
};

/** Approximate annual homeowners-insurance rate by state (fraction of home value). Estimate. */
export const STATE_INSURANCE: Record<string, number> = {
  FL: 0.0150, LA: 0.0120, OK: 0.0130, MS: 0.0100, AL: 0.0075, TX: 0.0095, AR: 0.0085,
  KS: 0.0090, NE: 0.0095, CO: 0.0085, SD: 0.0080, KY: 0.0075, MO: 0.0075, TN: 0.0065,
  GA: 0.0060, SC: 0.0060, NC: 0.0055, MN: 0.0060, IA: 0.0060, CA: 0.0055, MT: 0.0055,
  MI: 0.0050, IL: 0.0050, IN: 0.0050, OH: 0.0045, NY: 0.0045, VA: 0.0040, WA: 0.0035,
  OR: 0.0035, HI: 0.0035, WI: 0.0040,
};

const DEFAULT_TAX = 0.011;
const DEFAULT_INSURANCE = 0.005;

export function statePropertyTaxRate(abbr: string | undefined | null): number {
  return (abbr ? STATE_PROPERTY_TAX[abbr] : undefined) ?? DEFAULT_TAX;
}

export function stateInsuranceRate(abbr: string | undefined | null): number {
  return (abbr ? STATE_INSURANCE[abbr] : undefined) ?? DEFAULT_INSURANCE;
}
