"use client";

import { useState } from "react";
import { TILE_GRID, TILE_COLS } from "@/lib/geo/tilegrid";
import { affordabilityColor, AFFORDABILITY_LEGEND } from "@/lib/stateAffordability";
import { usd } from "@/lib/format";

export interface StateDatum {
  stateCode: string;
  name: string;
  homeValue: number;
  priceToIncome: number;
  requiredIncome: number;
  monthlyPayment: number;
  affordable: boolean;
}

export default function StateTileMap({ data }: { data: StateDatum[] }) {
  const byCode = new Map(data.map((d) => [d.stateCode, d]));
  const [hover, setHover] = useState<string | null>(null);
  const active = hover ? byCode.get(hover) : null;

  return (
    <div>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${TILE_COLS}, minmax(0, 1fr))` }}
      >
        {Object.entries(TILE_GRID).map(([code, pos]) => {
          const d = byCode.get(code);
          const color = d ? affordabilityColor(d.priceToIncome) : "var(--surface-2)";
          const isActive = hover === code;
          return (
            <button
              key={code}
              onMouseEnter={() => setHover(code)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(code)}
              onBlur={() => setHover(null)}
              className="relative aspect-square rounded-md text-[10px] font-semibold transition-transform sm:text-xs"
              style={{
                gridColumnStart: pos.c + 1,
                gridRowStart: pos.r + 1,
                backgroundColor: color,
                color: d ? "#fff" : "var(--muted)",
                outline: isActive ? "2px solid var(--text-1)" : "none",
                transform: isActive ? "scale(1.08)" : "none",
                zIndex: isActive ? 5 : 1,
              }}
              title={d ? `${d.name}: ${d.priceToIncome}× income` : code}
            >
              {code}
            </button>
          );
        })}
      </div>

      {/* Legend + hover detail */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-2)]">
          <span className="text-[var(--muted)]">Home price ÷ income:</span>
          {AFFORDABILITY_LEGEND.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 min-h-[3rem] rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm">
        {active ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <span className="font-semibold">{active.name}</span>
            <span className="text-[var(--text-2)]">Typical home: {usd(active.homeValue)}</span>
            <span className="text-[var(--text-2)]">{active.priceToIncome}× income</span>
            <span className="text-[var(--text-2)]">Income needed: {usd(active.requiredIncome)}</span>
            <span className="text-[var(--text-2)]">≈ {usd(active.monthlyPayment)}/mo</span>
            <span style={{ color: active.affordable ? "var(--good)" : "var(--critical)" }}>
              {active.affordable ? "Affordable to median household" : "Above median household's budget"}
            </span>
          </div>
        ) : (
          <span className="text-[var(--muted)]">Hover a state for its home value, the income needed to buy there, and whether the median household can afford it.</span>
        )}
      </div>
    </div>
  );
}
