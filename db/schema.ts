/**
 * Drizzle schema for House Tracker.
 *
 * Design notes:
 *  - `geographies` is the single geography spine (nation -> state -> metro -> county -> zip),
 *    keyed by standardized codes (FIPS for state/county, CBSA for metro, ZIP for zip).
 *  - `metric_series` is one unified long-format observations table for ALL time series
 *    (home values, rents, sale prices, days-on-market, inventory, income, HPI, ...),
 *    so new metrics don't require schema changes. Indexed for fast per-region reads.
 *  - `metric_catalog` describes each metric_key (label, unit, category, source) and drives
 *    the UI without hard-coding.
 */
import {
  pgTable,
  serial,
  integer,
  text,
  varchar,
  doublePrecision,
  date,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";

export const geoLevel = pgEnum("geo_level", [
  "nation",
  "state",
  "metro",
  "county",
  "city",
  "zip",
]);

export const geographies = pgTable(
  "geographies",
  {
    id: serial("id").primaryKey(),
    level: geoLevel("level").notNull(),
    /** Standardized code: FIPS (state/county), CBSA (metro), ZIP, or "US" for nation. */
    code: varchar("code", { length: 24 }).notNull(),
    name: text("name").notNull(),
    stateCode: varchar("state_code", { length: 2 }),
    parentId: integer("parent_id"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
  },
  (t) => ({
    codeLevelUq: uniqueIndex("geo_code_level_uq").on(t.level, t.code),
    parentIdx: index("geo_parent_idx").on(t.parentId),
    stateIdx: index("geo_state_idx").on(t.stateCode),
  }),
);

export const metricFreq = pgEnum("metric_freq", [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "annual",
]);

export const metricCatalog = pgTable("metric_catalog", {
  metricKey: varchar("metric_key", { length: 64 }).primaryKey(),
  label: text("label").notNull(),
  unit: varchar("unit", { length: 32 }).notNull(), // usd, percent, days, count, index, ratio
  category: varchar("category", { length: 32 }).notNull(), // price, rent, market, rate, income
  source: varchar("source", { length: 32 }).notNull(), // zillow, redfin, realtor, fred, census, hud
  description: text("description"),
});

export const metricSeries = pgTable(
  "metric_series",
  {
    id: serial("id").primaryKey(),
    geographyId: integer("geography_id")
      .notNull()
      .references(() => geographies.id, { onDelete: "cascade" }),
    metricKey: varchar("metric_key", { length: 64 })
      .notNull()
      .references(() => metricCatalog.metricKey),
    periodDate: date("period_date").notNull(),
    freq: metricFreq("freq").notNull(),
    value: doublePrecision("value").notNull(),
  },
  (t) => ({
    // One value per (geography, metric, period). Upserts hit this key.
    uq: uniqueIndex("series_geo_metric_period_uq").on(
      t.geographyId,
      t.metricKey,
      t.periodDate,
    ),
    lookupIdx: index("series_lookup_idx").on(t.geographyId, t.metricKey, t.periodDate),
  }),
);

export const mortgageProduct = pgEnum("mortgage_product", ["30yr", "15yr"]);

export const mortgageRates = pgTable(
  "mortgage_rates",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    product: mortgageProduct("product").notNull(),
    rate: doublePrecision("rate").notNull(), // annual percent, e.g. 6.81
    source: varchar("source", { length: 32 }).notNull().default("fred"),
  },
  (t) => ({
    uq: uniqueIndex("rate_date_product_uq").on(t.date, t.product),
  }),
);

// --------------------------------------------------------------------------
// User-facing: accounts, buying profile, watchlist, alerts
// --------------------------------------------------------------------------

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userProfiles = pgTable("user_profiles", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  grossAnnualIncome: doublePrecision("gross_annual_income"),
  downPaymentAmount: doublePrecision("down_payment_amount"),
  downPaymentPercent: doublePrecision("down_payment_percent"),
  monthlyDebts: doublePrecision("monthly_debts"),
  creditTier: varchar("credit_tier", { length: 16 }), // excellent, good, fair, poor
  guidelineKey: varchar("guideline_key", { length: 32 }).default("qm"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const watchlist = pgTable(
  "watchlist",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    geographyId: integer("geography_id")
      .notNull()
      .references(() => geographies.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    uq: uniqueIndex("watch_user_geo_uq").on(t.userId, t.geographyId),
  }),
);

export const alertChannel = pgEnum("alert_channel", ["email", "push"]);

/**
 * Generic, configurable alert rule. `type` selects the evaluator; `params` carries its
 * config (metric_key, geography_id, comparator, threshold, etc.) so new alert types
 * don't need schema changes.
 */
export const alertRules = pgTable("alert_rules", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 32 }).notNull(), // rate_threshold, price_move, affordability, market_heat, digest
  params: jsonb("params").notNull().$type<Record<string, unknown>>(),
  channels: jsonb("channels").notNull().$type<("email" | "push")[]>(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const alertEvents = pgTable(
  "alert_events",
  {
    id: serial("id").primaryKey(),
    ruleId: integer("rule_id")
      .notNull()
      .references(() => alertRules.id, { onDelete: "cascade" }),
    firedAt: timestamp("fired_at").notNull().defaultNow(),
    /** Dedupe key so we don't re-fire the same condition (e.g. "2026-07-03:rate<=6"). */
    dedupeKey: varchar("dedupe_key", { length: 128 }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
  },
  (t) => ({
    uq: uniqueIndex("event_rule_dedupe_uq").on(t.ruleId, t.dedupeKey),
    ruleIdx: index("event_rule_idx").on(t.ruleId),
  }),
);

// Push subscriptions for web-push (PWA).
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
