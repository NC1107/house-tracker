/**
 * Buyer profile — the user's own numbers, stored in a cookie so server components can
 * personalize (recolor the map, personalize the Overview, prefill calculators) without auth.
 * The client ProfileControls writes the cookie and refreshes.
 */
import { cookies } from "next/headers";
import { DEFAULT_PROFILE, PROFILE_COOKIE, type BuyerProfile } from "@/lib/profile-shared";

export { DEFAULT_PROFILE, PROFILE_COOKIE };
export type { BuyerProfile };

function clampNum(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

export async function getProfile(): Promise<BuyerProfile & { isCustom: boolean }> {
  const raw = (await cookies()).get(PROFILE_COOKIE)?.value;
  if (!raw) return { ...DEFAULT_PROFILE, isCustom: false };
  try {
    const p = JSON.parse(decodeURIComponent(raw));
    return {
      income: clampNum(p.income, DEFAULT_PROFILE.income, 0, 100_000_000),
      downPct: clampNum(p.downPct, DEFAULT_PROFILE.downPct, 0, 1),
      monthlyDebts: clampNum(p.monthlyDebts, 0, 0, 1_000_000),
      isCustom: true,
    };
  } catch {
    return { ...DEFAULT_PROFILE, isCustom: false };
  }
}
