/**
 * Alert rule evaluation — pure, testable logic that decides whether a rule fires given the
 * latest data, and produces a human message + a dedupe key (so the same condition doesn't
 * re-fire). This is the correctness core of the notifications feature; delivery (email/web
 * push) and the create-rule UI/auth are separate and configured by the operator.
 */
import { usd } from "@/lib/format";

export type AlertRuleType =
  | "rate_threshold"
  | "price_move"
  | "market_heat"
  | "affordability"
  | "listing_match";

export interface AlertRule {
  id: number | string;
  type: AlertRuleType;
  params: Record<string, unknown>;
  regionName?: string;
}

export interface AlertEvaluation {
  fired: boolean;
  message?: string;
  /** Stable key for (rule, condition, period) so we don't notify twice for the same event. */
  dedupeKey?: string;
}

const noFire: AlertEvaluation = { fired: false };

/** Rate dropped to/below a target. params: { product, below }. ctx: latest rate + date. */
export function evalRateThreshold(
  rule: AlertRule,
  ctx: { rate: number | null; date: string | null },
): AlertEvaluation {
  const below = Number(rule.params.below);
  if (ctx.rate == null || !Number.isFinite(below)) return noFire;
  if (ctx.rate <= below) {
    return {
      fired: true,
      message: `30-yr mortgage rate is ${ctx.rate.toFixed(2)}%, at or below your ${below}% target.`,
      dedupeKey: `rate<=${below}@${ctx.date}`,
    };
  }
  return noFire;
}

/**
 * A watched region's value moved beyond a threshold. params: { pctThreshold, direction }.
 * ctx: yoy percent change + date. direction 'down' fires on drops (good for buyers), 'up'
 * on rises, 'any' on either.
 */
export function evalPriceMove(
  rule: AlertRule,
  ctx: { yoyPct: number | null; date: string | null },
): AlertEvaluation {
  const threshold = Number(rule.params.pctThreshold);
  const direction = (rule.params.direction as string) ?? "down";
  if (ctx.yoyPct == null || !Number.isFinite(threshold)) return noFire;
  const hitDown = direction !== "up" && ctx.yoyPct <= -Math.abs(threshold);
  const hitUp = direction !== "down" && ctx.yoyPct >= Math.abs(threshold);
  if (hitDown || hitUp) {
    const dir = ctx.yoyPct < 0 ? "down" : "up";
    return {
      fired: true,
      message: `${rule.regionName ?? "A watched region"} prices are ${dir} ${Math.abs(ctx.yoyPct).toFixed(1)}% year-over-year.`,
      dedupeKey: `pmove:${rule.id}:${dir}@${ctx.date}`,
    };
  }
  return noFire;
}

/** Market-heat score crossed a buyer-leverage threshold. params: { minScore }. */
export function evalMarketHeat(
  rule: AlertRule,
  ctx: { score: number | null; date: string | null },
): AlertEvaluation {
  const minScore = Number(rule.params.minScore);
  if (ctx.score == null || !Number.isFinite(minScore)) return noFire;
  if (ctx.score >= minScore) {
    return {
      fired: true,
      message: `${rule.regionName ?? "A watched region"} buyer-leverage score is ${ctx.score} (at or above your ${minScore}), more room to negotiate.`,
      dedupeKey: `heat>=${minScore}:${rule.id}@${ctx.date}`,
    };
  }
  return noFire;
}

/** A region's typical home became affordable to the user. params: { maxPrice }. ctx: price. */
export function evalAffordability(
  rule: AlertRule,
  ctx: { requiredIncome: number | null; income: number; date: string | null },
): AlertEvaluation {
  if (ctx.requiredIncome == null) return noFire;
  if (ctx.requiredIncome <= ctx.income) {
    return {
      fired: true,
      message: `${rule.regionName ?? "A watched region"} is now within your budget; it needs about ${usd(ctx.requiredIncome)} and you earn ${usd(ctx.income)}.`,
      dedupeKey: `afford:${rule.id}@${ctx.date}`,
    };
  }
  return noFire;
}

export interface MatchedListing {
  address: string;
  city: string;
  price: number;
  url: string;
  mls: string;
}

/** Human-readable summary of a saved search's filters, used in messages and the UI. */
export function describeListingFilters(p: Record<string, unknown>): string {
  const parts: string[] = [];
  if (Number(p.minBeds) > 0) parts.push(`${p.minBeds}+ bd`);
  if (Number(p.minBaths) > 0) parts.push(`${p.minBaths}+ ba`);
  if (Number(p.minStories) > 1) parts.push(`${p.minStories}+ stories`);
  if (p.basement) parts.push("basement");
  if (Number(p.maxPrice) > 0) parts.push(`under ${usd(Number(p.maxPrice))}`);
  return parts.join(", ") || "any home";
}

/**
 * New listings matched a saved search. The runner is responsible for passing ONLY
 * listings not seen before (per-listing dedupe via alert_events); this evaluator just
 * decides fired-ness and formats the message.
 */
export function evalListingMatch(
  rule: AlertRule,
  ctx: { newListings: MatchedListing[]; date: string | null },
): AlertEvaluation {
  if (!ctx.newListings.length) return noFire;
  const where = (rule.params.stateName as string) ?? rule.regionName ?? "your search area";
  const shown = ctx.newListings.slice(0, 5);
  const items = shown
    .map((l) => {
      const label = `${l.address || "Address withheld"}, ${l.city} (${usd(l.price)})`;
      return l.url ? `<a href="${l.url}">${label}</a>` : label;
    })
    .join("; ");
  const extra = ctx.newListings.length > shown.length ? ` and ${ctx.newListings.length - shown.length} more` : "";
  return {
    fired: true,
    message: `${ctx.newListings.length} new listing${ctx.newListings.length > 1 ? "s" : ""} in ${where} match your search (${describeListingFilters(rule.params)}): ${items}${extra}.`,
    dedupeKey: `match:${rule.id}@${ctx.date}:${shown.map((l) => l.mls || l.url).join("|")}`.slice(0, 128),
  };
}

/** Dispatch to the right evaluator. ctx is a superset of what each evaluator needs. */
export function evaluateAlert(
  rule: AlertRule,
  ctx: {
    rate?: number | null;
    yoyPct?: number | null;
    score?: number | null;
    requiredIncome?: number | null;
    income?: number;
    newListings?: MatchedListing[];
    date?: string | null;
  },
): AlertEvaluation {
  const date = ctx.date ?? null;
  switch (rule.type) {
    case "rate_threshold":
      return evalRateThreshold(rule, { rate: ctx.rate ?? null, date });
    case "price_move":
      return evalPriceMove(rule, { yoyPct: ctx.yoyPct ?? null, date });
    case "market_heat":
      return evalMarketHeat(rule, { score: ctx.score ?? null, date });
    case "affordability":
      return evalAffordability(rule, { requiredIncome: ctx.requiredIncome ?? null, income: ctx.income ?? 0, date });
    case "listing_match":
      return evalListingMatch(rule, { newListings: ctx.newListings ?? [], date });
    default:
      return noFire;
  }
}
