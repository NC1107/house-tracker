/** Client-safe profile constants/types (no next/headers, so client components can import). */
import { NATIONAL } from "@/lib/reference";

export interface BuyerProfile {
  income: number;
  downPct: number; // fraction
  monthlyDebts: number;
}

export const DEFAULT_PROFILE: BuyerProfile = {
  income: NATIONAL.medianHouseholdIncome,
  downPct: NATIONAL.typicalDownPaymentPct,
  monthlyDebts: 0,
};

export const PROFILE_COOKIE = "ht_profile";
