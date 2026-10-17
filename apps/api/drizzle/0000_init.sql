-- PostGIS es necesario para merchant_locations.geo (añadido a mano).
CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE TYPE "public"."consent_type" AS ENUM('TERMS', 'MKT_PLATFORM', 'SHARE_WITH_MERCHANT');--> statement-breakpoint
CREATE TYPE "public"."merchant_status" AS ENUM('ONBOARDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."merchant_user_role" AS ENUM('OWNER', 'MANAGER', 'STAFF');--> statement-breakpoint
CREATE TYPE "public"."qr_code_status" AS ENUM('ACTIVE', 'REVOKED', 'CONSUMED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."qr_code_type" AS ENUM('STATIC_TABLE', 'STATIC_COUNTER', 'DYNAMIC_AMOUNT');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'BLOCKED', 'DELETED');--> statement-breakpoint
CREATE TABLE "merchant_locations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"geo" geography(Point, 4326) NOT NULL,
	"timezone" text DEFAULT 'Europe/Madrid' NOT NULL,
	"opening_hours" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"category" text NOT NULL,
	"pos_integration_id" uuid,
	"tip_config" jsonb DEFAULT '{"enabled":true,"percentages":[0,5,10]}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"merchant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "merchant_user_role" NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"legal_name" text NOT NULL,
	"tax_id" text NOT NULL,
	"brand_name" text NOT NULL,
	"logo_url" text,
	"status" "merchant_status" DEFAULT 'ONBOARDING' NOT NULL,
	"psp" text,
	"psp_account_id" text,
	"psp_kyb_status" text,
	"plan_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchants_psp_account_id_unique" UNIQUE("psp_account_id")
);
--> statement-breakpoint
CREATE TABLE "tables" (
	"id" uuid PRIMARY KEY NOT NULL,
	"location_id" uuid NOT NULL,
	"label" text NOT NULL,
	"capacity" integer DEFAULT 4 NOT NULL,
	"external_table_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qr_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" "qr_code_type" NOT NULL,
	"location_id" uuid NOT NULL,
	"table_id" uuid,
	"short_code" text NOT NULL,
	"signature" text NOT NULL,
	"amount_cents" bigint,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"nonce" text,
	"expires_at" timestamp with time zone,
	"status" "qr_code_status" DEFAULT 'ACTIVE' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qr_codes_short_code_unique" UNIQUE("short_code")
);
--> statement-breakpoint
CREATE TABLE "user_consents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "consent_type" NOT NULL,
	"merchant_id" uuid,
	"granted" boolean NOT NULL,
	"version" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"phone_e164_enc" text NOT NULL,
	"phone_hash" text NOT NULL,
	"email_enc" text,
	"name" text,
	"birthdate" date,
	"locale" text DEFAULT 'es' NOT NULL,
	"status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"risk_score" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_hash_unique" UNIQUE("phone_hash")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"aggregate" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "merchant_locations" ADD CONSTRAINT "merchant_locations_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_users" ADD CONSTRAINT "merchant_users_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_location_id_merchant_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."merchant_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_location_id_merchant_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."merchant_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_created_by_merchant_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."merchant_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "merchant_locations_merchant_idx" ON "merchant_locations" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "merchant_locations_geo_idx" ON "merchant_locations" USING gist ("geo");--> statement-breakpoint
CREATE UNIQUE INDEX "tables_location_label_uq" ON "tables" USING btree ("location_id","label");--> statement-breakpoint
CREATE INDEX "qr_codes_table_idx" ON "qr_codes" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "qr_codes_location_idx" ON "qr_codes" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "qr_codes_one_active_per_table_uq" ON "qr_codes" USING btree ("table_id") WHERE "qr_codes"."status" = 'ACTIVE' and "qr_codes"."type" = 'STATIC_TABLE';--> statement-breakpoint
CREATE INDEX "user_consents_lookup_idx" ON "user_consents" USING btree ("user_id","type","merchant_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "outbox_events_unpublished_idx" ON "outbox_events" USING btree ("created_at") WHERE "outbox_events"."published_at" is null;