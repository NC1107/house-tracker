/** Client-safe profile constants/types (no next/headers, so client components can import). */
import { NATIONAL } from "@/lib/reference";

export interface BuyerProfile {
  income: number;
  downPct: number; // fraction
  monthlyDebts: number;
  /** Where they're looking to buy; drives defaults on Deals/Market/Explore. */
  homeState: string;
  homeCities: string[];
  /** Work location for the distance-to-work feature (geocoded once at save time). */
  workAddress: string;
  workLat: number | null;
  workLng: number | null;
}

export const DEFAULT_PROFILE: BuyerProfile = {
  income: NATIONAL.medianHouseholdIncome,
  downPct: NATIONAL.typicalDownPaymentPct,
  monthlyDebts: 0,
  homeState: "",
  homeCities: [],
  workAddress: "",
  workLat: null,
  workLng: null,
};

export const PROFILE_COOKIE = "ht_profile";
