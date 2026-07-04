"use client";

import { useState } from "react";
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

export interface MapPath {
  fips: string;
  stateCode: string | undefined;
  name: string;
  d: string;
}

export default function ChoroplethMap({
  paths,
  width,
  height,
  data,
}: {
  paths: MapPath[];
  width: number;
  height: number;
  data: StateDatum[];
}) {
  const byCode = new Map(data.map((d) => [d.stateCode, d]));
  const [hover, setHover] = useState<string | null>(null);
  const active = hover ? byCode.get(hover) : null;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="US state home-affordability choropleth"
      >
        {paths.map((p) => {
          const d = p.stateCode ? byCode.get(p.stateCode) : undefined;
          const fill = d ? affordabilityColor(d.priceToIncome) : "var(--surface-2)";
          const isActive = p.stateCode != null && hover === p.stateCode;
          return (
            <path
              key={p.fips}
              d={p.d}
              fill={fill}
              stroke={isActive ? "var(--text-1)" : "var(--surface)"}
              strokeWidth={isActive ? 1.5 : 0.75}
              style={{ cursor: d ? "pointer" : "default", transition: "opacity .1s" }}
              opacity={hover && !isActive ? 0.72 : 1}
              tabIndex={d ? 0 : -1}
              role={d ? "button" : undefined}
              aria-label={
                d
                  ? `${p.name}: ${d.priceToIncome}× income, ${d.affordable ? "affordable" : "above budget"} — see the ranked table for details`
                  : undefined
              }
              onMouseEnter={() => p.stateCode && setHover(p.stateCode)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => p.stateCode && setHover(p.stateCode)}
              onBlur={() => setHover(null)}
            >
              <title>{d ? `${p.name}: ${d.priceToIncome}× income` : p.name}</title>
            </path>
          );
        })}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-2)]">
        <span className="text-[var(--muted)]">Home price ÷ income:</span>
        {AFFORDABILITY_LEGEND.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: l.color }} />
            {l.label}
          </span>
        ))}
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
