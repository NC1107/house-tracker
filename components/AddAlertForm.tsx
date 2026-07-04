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

      <button type="submit" className="btn">Add alert</button>
    </form>
  );
}
