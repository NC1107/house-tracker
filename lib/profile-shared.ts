/** Client-safe profile constants/types (no next/headers, so client components can import). */
import { NATIONAL } from "@/lib/reference";

export interface BuyerProfile {
  income: number;
  downPct: number; // fraction
  monthlyDebts: number;
  /** Where they're looking to buy; drives defaults on Deals/Market/Explore. */
  homeState: string;
  homeCities: string[];
}

export const DEFAULT_PROFILE: BuyerProfile = {
  income: NATIONAL.medianHouseholdIncome,
  downPct: NATIONAL.typicalDownPaymentPct,
  monthlyDebts: 0,
  homeState: "",
  homeCities: [],
};

export const PROFILE_COOKIE = "ht_profile";
