CREATE TYPE "public"."alert_channel" AS ENUM('email', 'push');--> statement-breakpoint
CREATE TYPE "public"."geo_level" AS ENUM('nation', 'state', 'metro', 'county', 'city', 'zip');--> statement-breakpoint
CREATE TYPE "public"."metric_freq" AS ENUM('daily', 'weekly', 'monthly', 'quarterly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."mortgage_product" AS ENUM('30yr', '15yr');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alert_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" integer NOT NULL,
	"fired_at" timestamp DEFAULT now() NOT NULL,
	"dedupe_key" varchar(128) NOT NULL,
	"payload" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alert_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" varchar(32) NOT NULL,
	"params" jsonb NOT NULL,
	"channels" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "geographies" (
	"id" serial PRIMARY KEY NOT NULL,
	"level" "geo_level" NOT NULL,
	"code" varchar(24) NOT NULL,
	"name" text NOT NULL,
	"state_code" varchar(2),
	"parent_id" integer,
	"lat" double precision,
	"lng" double precision
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "metric_catalog" (
	"metric_key" varchar(64) PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"unit" varchar(32) NOT NULL,
	"category" varchar(32) NOT NULL,
	"source" varchar(32) NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "metric_series" (
	"id" serial PRIMARY KEY NOT NULL,
	"geography_id" integer NOT NULL,
	"metric_key" varchar(64) NOT NULL,
	"period_date" date NOT NULL,
	"freq" "metric_freq" NOT NULL,
	"value" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mortgage_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"product" "mortgage_product" NOT NULL,
	"rate" double precision NOT NULL,
	"source" varchar(32) DEFAULT 'fred' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_profiles" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"gross_annual_income" double precision,
	"down_payment_amount" double precision,
	"down_payment_percent" double precision,
	"monthly_debts" double precision,
	"credit_tier" varchar(16),
	"guideline_key" varchar(32) DEFAULT 'qm',
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "watchlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"geography_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_rule_id_alert_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "metric_series" ADD CONSTRAINT "metric_series_geography_id_geographies_id_fk" FOREIGN KEY ("geography_id") REFERENCES "public"."geographies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "metric_series" ADD CONSTRAINT "metric_series_metric_key_metric_catalog_metric_key_fk" FOREIGN KEY ("metric_key") REFERENCES "public"."metric_catalog"("metric_key") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_geography_id_geographies_id_fk" FOREIGN KEY ("geography_id") REFERENCES "public"."geographies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_rule_dedupe_uq" ON "alert_events" USING btree ("rule_id","dedupe_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_rule_idx" ON "alert_events" USING btree ("rule_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "geo_code_level_uq" ON "geographies" USING btree ("level","code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "geo_parent_idx" ON "geographies" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "geo_state_idx" ON "geographies" USING btree ("state_code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "series_geo_metric_period_uq" ON "metric_series" USING btree ("geography_id","metric_key","period_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "series_lookup_idx" ON "metric_series" USING btree ("geography_id","metric_key","period_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rate_date_product_uq" ON "mortgage_rates" USING btree ("date","product");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "watch_user_geo_uq" ON "watchlist" USING btree ("user_id","geography_id");