"use client";

import { useState } from "react";
import { createAlert } from "@/app/alerts/actions";

type StateOpt = { id: number; name: string };

export default function AddAlertForm({ states }: { states: StateOpt[] }) {
  const [type, setType] = useState("rate_threshold");

  return (
    <form action={createAlert} className="card space-y-4">
      <h2 className="font-semibold">Add an alert</h2>

      <label className="block">
        <span className="label">Alert me when…</span>
        <select name="type" value={type} onChange={(e) => setType(e.target.value)} className="input">
          <option value="rate_threshold">The 30-yr mortgage rate drops below a target</option>
          <option value="market_heat">A state becomes a buyer&apos;s market</option>
          <option value="price_move">A state&apos;s prices move by a threshold</option>
          <option value="listing_match">A home matching my filters hits the market</option>
        </select>
      </label>

      {type === "rate_threshold" && (
        <label className="block">
          <span className="label">Rate below (%)</span>
          <input type="number" name="below" min={0} step={0.125} defaultValue={6} className="input max-w-[10rem]" />
        </label>
      )}

      {type === "market_heat" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">State</span>
            <select name="geographyId" className="input">
              {states.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Buyer-leverage score ≥</span>
            <input type="number" name="minScore" min={0} max={100} step={1} defaultValue={60} className="input" />
          </label>
        </div>
      )}

      {type === "price_move" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="label">State</span>
            <select name="geographyId" className="input">
              {states.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Direction</span>
            <select name="direction" className="input" defaultValue="down">
              <option value="down">Falls (good for buyers)</option>
              <option value="up">Rises</option>
              <option value="any">Either</option>
            </select>
          </label>
          <label className="block">
            <span className="label">By at least (% YoY)</span>
            <input type="number" name="pctThreshold" min={0} step={0.5} defaultValue={3} className="input" />
          </label>
        </div>
      )}

      {type === "listing_match" && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="label">State</span>
              <select name="stateName" className="input">
                {states.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">City (optional)</span>
              <input type="text" name="cityName" placeholder="anywhere in state" className="input" />
            </label>
            <label className="block">
              <span className="label">Max price ($)</span>
              <input type="number" name="maxPrice" min={0} step={10000} defaultValue={400000} className="input" />
            </label>
            <label className="block">
              <span className="label">Min bedrooms</span>
              <input type="number" name="minBeds" min={0} max={10} step={1} defaultValue={4} className="input" />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="label">Min bathrooms</span>
              <input type="number" name="minBaths" min={0} max={10} step={1} defaultValue={2} className="input" />
            </label>
            <label className="block">
              <span className="label">Min stories</span>
              <input type="number" name="minStories" min={1} max={4} step={1} defaultValue={2} className="input" />
            </label>
            <label className="block">
              <span className="label">Min price ($, filters $1 auctions)</span>
              <input type="number" name="minPrice" min={0} step={5000} defaultValue={10000} className="input" />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="label">Min sqft (optional)</span>
              <input type="number" name="minSqft" min={0} step={100} placeholder="any" className="input" />
            </label>
            <label className="block">
              <span className="label">Built after (optional)</span>
              <input type="number" name="minYearBuilt" min={1800} max={2030} placeholder="any" className="input" />
            </label>
            <label className="mt-6 flex items-center gap-2 text-sm">
              <input type="checkbox" name="basement" value="1" className="accent-[var(--brand)]" />
              Must have a basement
            </label>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Checked daily against live listings. The first check records what&apos;s already on the
            market; you&apos;re emailed only about homes that appear after that. Garage can&apos;t be
            filtered by the listing feed, so check the listing itself for parking.
          </p>
        </div>
      )}

      <button type="submit" className="btn">Add alert</button>
    </form>
  );
}
