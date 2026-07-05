"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PROFILE_COOKIE } from "@/lib/profile-shared";
import { usd } from "@/lib/format";
import NumberField from "@/components/NumberField";
import SegmentedControl from "@/components/SegmentedControl";
import { REDFIN_CITY_REGION_IDS } from "@/lib/sources/redfin-cities";

const NUMBERS_COOKIE = "ht_numbers"; // persistent store of the user's entered numbers
const DISMISSED_COOKIE = "ht_seen"; // set once the first-visit prompt is answered

type Numbers = {
  income: number;
  downPct: number;
  monthlyDebts: number;
  homeState: string;
  homeCities: string[];
  workAddress: string;
  workLat: number | null;
  workLng: number | null;
};

/**
 * Global buyer-profile control shown once under the header (replaces the old per-page
 * form). A one-time popup collects the user's numbers on first visit; after that a single
 * toggle flips every page between "US average" and "My numbers".
 *
 * Two cookies drive it: `ht_profile` (read server-side by getProfile — present means
 * personalized) and `ht_numbers` (a durable copy of what they entered, so toggling to the
 * average view and back doesn't lose their inputs).
 */
export default function ProfileControls({
  income,
  downPct,
  monthlyDebts,
  isCustom,
}: {
  income: number;
  downPct: number; // fraction
  monthlyDebts: number;
  isCustom: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<Numbers | null>(null);
  const [open, setOpen] = useState(false);

  // Draft values while editing.
  const [inc, setInc] = useState(income);
  const [dp, setDp] = useState(Math.round(downPct * 100));
  const [debts, setDebts] = useState(monthlyDebts);
  const [homeState, setHomeState] = useState("");
  const [homeCities, setHomeCities] = useState<string[]>([]);
  const [workAddress, setWorkAddress] = useState("");
  const [geocodeNote, setGeocodeNote] = useState("");
  const [saving, setSaving] = useState(false);
  const stateCities = REDFIN_CITY_REGION_IDS[homeState] ?? [];

  // On mount, load any durable numbers; open the popup on a genuine first visit.
  useEffect(() => {
    const stored = readNumbers();
    setSaved(stored);
    if (stored) {
      setInc(stored.income);
      setDp(Math.round(stored.downPct * 100));
      setDebts(stored.monthlyDebts);
      setHomeState(stored.homeState);
      setHomeCities(stored.homeCities);
      setWorkAddress(stored.workAddress ?? "");
    }
    if (!stored && !getCookie(DISMISSED_COOKIE)) setOpen(true);
  }, []);

  function personalize(n: Numbers) {
    writeCookie(PROFILE_COOKIE, JSON.stringify(n));
    router.refresh();
  }

  async function save() {
    setSaving(true);
    setGeocodeNote("");
    // Geocode the work address once at save time (US Census geocoder via our proxy).
    let workLat: number | null = null;
    let workLng: number | null = null;
    if (workAddress.trim().length >= 5) {
      try {
        const r = await fetch(`/api/geocode?address=${encodeURIComponent(workAddress.trim())}`);
        const g = await r.json();
        if (g.ok) {
          workLat = g.lat;
          workLng = g.lng;
        } else {
          setGeocodeNote("Couldn't locate that address; distance-to-work stays off. Try adding city, state, and zip.");
        }
      } catch {
        setGeocodeNote("Address lookup failed; distance-to-work stays off.");
      }
    }
    const n: Numbers = {
      income: inc, downPct: dp / 100, monthlyDebts: debts,
      homeState, homeCities,
      workAddress: workAddress.trim(), workLat, workLng,
    };
    writeCookie(NUMBERS_COOKIE, JSON.stringify(n));
    writeCookie(DISMISSED_COOKIE, "1");
    setSaved(n);
    personalize(n);
    setSaving(false);
    setOpen(false);
  }

  function useAverages() {
    clearCookie(PROFILE_COOKIE);
    writeCookie(DISMISSED_COOKIE, "1");
    router.refresh();
    setOpen(false);
  }

  function useMine() {
    if (saved) personalize(saved);
    else setOpen(true);
  }

  function clearMine() {
    clearCookie(PROFILE_COOKIE);
    clearCookie(NUMBERS_COOKIE);
    setSaved(null);
    router.refresh();
    setOpen(false);
  }

  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-3 text-sm">
        <SegmentedControl
          ariaLabel="Whose numbers to show"
          value={isCustom ? "me" : "avg"}
          onChange={(v) => (v === "avg" ? useAverages() : useMine())}
          options={[
            { value: "avg", label: "US avg", ariaLabel: "Use US average numbers" },
            { value: "me", label: "Me", ariaLabel: "Use my numbers" },
          ]}
        />
        <span className="text-[var(--text-2)]">
          {usd(income)}/yr · {Math.round(downPct * 100)}% down
          {monthlyDebts > 0 ? ` · ${usd(monthlyDebts)}/mo debts` : ""}
        </span>
      </div>
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg px-3 py-1.5 text-sm text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]">
        {saved ? "Edit my numbers" : "Enter my numbers"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Enter your numbers"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
            <h2 className="text-lg font-semibold">Make it about you</h2>
            <p className="mt-1 text-sm text-[var(--text-2)]">
              Enter your numbers once and every page personalizes to your situation. You can switch back
              to US averages any time.
            </p>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="label">Household income /yr</span>
                <NumberField value={inc} onChange={setInc} prefix="$" step={5000} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="label">Down payment</span>
                  <NumberField value={dp} onChange={setDp} suffix="%" step={1} max={100} />
                </label>
                <label className="block">
                  <span className="label">Monthly debt payments</span>
                  <NumberField value={debts} onChange={setDebts} prefix="$" step={50} />
                  <p className="mt-1 text-xs leading-snug text-[var(--muted)]">
                    Loan/card minimums only, not rent or general spending.
                  </p>
                </label>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <label className="block">
                <span className="label">Where are you looking to buy? (optional)</span>
                <select
                  className="input"
                  value={homeState}
                  onChange={(e) => {
                    setHomeState(e.target.value);
                    setHomeCities([]);
                  }}
                >
                  <option value="">Anywhere / not sure yet</option>
                  {Object.keys(REDFIN_CITY_REGION_IDS).map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">Work address (optional, enables distance-to-work on listings)</span>
                <input
                  type="text"
                  className="input"
                  placeholder="123 Main St, Baltimore, MD 21201"
                  value={workAddress}
                  onChange={(e) => setWorkAddress(e.target.value)}
                />
                {geocodeNote && <p className="mt-1 text-xs text-[var(--warning)]">{geocodeNote}</p>}
              </label>
              {stateCities.length > 0 && (
                <fieldset>
                  <span className="label">Cities (pick any)</span>
                  <div className="grid max-h-36 grid-cols-2 gap-x-2 gap-y-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2 text-sm">
                    {stateCities.map((c) => (
                      <label key={c.id} className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={homeCities.includes(c.name)}
                          onChange={(e) =>
                            setHomeCities((prev) =>
                              e.target.checked ? [...prev, c.name] : prev.filter((n) => n !== c.name),
                            )
                          }
                          className="accent-[var(--brand)]"
                        />
                        <span className="truncate">{c.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={useAverages} className="rounded-lg px-3 py-2 text-sm text-[var(--text-2)] hover:bg-[var(--surface-2)]">
                Use US averages
              </button>
              <div className="flex gap-2">
                {saved && (
                  <button type="button" onClick={clearMine} className="rounded-lg px-3 py-2 text-sm text-[var(--text-2)] hover:bg-[var(--surface-2)]">
                    Clear
                  </button>
                )}
                <button type="button" onClick={save} disabled={saving} className="btn">
                  {saving ? "Saving..." : "Save & personalize"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function readNumbers(): Numbers | null {
  const raw = getCookie(NUMBERS_COOKIE);
  if (!raw) return null;
  try {
    const p = JSON.parse(decodeURIComponent(raw));
    const n: Numbers = {
      income: Number(p.income),
      downPct: Number(p.downPct),
      monthlyDebts: Number(p.monthlyDebts),
      homeState: typeof p.homeState === "string" ? p.homeState : "",
      homeCities: Array.isArray(p.homeCities) ? p.homeCities.filter((c: unknown) => typeof c === "string") : [],
      workAddress: typeof p.workAddress === "string" ? p.workAddress : "",
      workLat: Number.isFinite(Number(p.workLat)) && p.workLat != null ? Number(p.workLat) : null,
      workLng: Number.isFinite(Number(p.workLng)) && p.workLng != null ? Number(p.workLng) : null,
    };
    return Number.isFinite(n.income) && Number.isFinite(n.downPct) && Number.isFinite(n.monthlyDebts) ? n : null;
  } catch {
    return null;
  }
}

function getCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? m[1] : null;
}
function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=31536000;samesite=lax`;
}
function clearCookie(name: string) {
  document.cookie = `${name}=;path=/;max-age=0;samesite=lax`;
}
