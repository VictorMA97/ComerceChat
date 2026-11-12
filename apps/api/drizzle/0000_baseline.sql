-- Línea base de F1.6 (ADR-029): un esquema de Postgres por contexto y sin claves foráneas entre
-- contextos. Sustituye a las migraciones 0000–0006 de la PoC (no había datos de producción).
-- Añadido a mano (ADR-019): PostGIS, para venues.merchant_locations.geo. drizzle-kit entrecomilla el
-- tipo geography; se ha corregido abajo.
CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE SCHEMA "platform";
--> statement-breakpoint
CREATE SCHEMA "identity";
--> statement-breakpoint
CREATE SCHEMA "venues";
--> statement-breakpoint
CREATE SCHEMA "payments";
--> statement-breakpoint
CREATE SCHEMA "loyalty";
--> statement-breakpoint
CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE SCHEMA "analytics";
--> statement-breakpoint
CREATE SCHEMA "fake_pos";
--> statement-breakpoint
CREATE SCHEMA "fake_psp";
--> statement-breakpoint
CREATE TYPE "identity"."consent_type" AS ENUM('TERMS', 'MKT_PLATFORM', 'SHARE_WITH_MERCHANT');--> statement-breakpoint
CREATE TYPE "identity"."merchant_user_role" AS ENUM('OWNER', 'MANAGER', 'STAFF');--> statement-breakpoint
CREATE TYPE "identity"."user_status" AS ENUM('ACTIVE', 'BLOCKED', 'DELETED');--> statement-breakpoint
CREATE TYPE "venues"."merchant_status" AS ENUM('ONBOARDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "venues"."qr_code_status" AS ENUM('ACTIVE', 'REVOKED', 'CONSUMED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "venues"."qr_code_type" AS ENUM('STATIC_TABLE', 'STATIC_COUNTER', 'DYNAMIC_AMOUNT');--> statement-breakpoint
CREATE TYPE "payments"."allocation_status" AS ENUM('RESERVED', 'PAID', 'RELEASED');--> statement-breakpoint
CREATE TYPE "payments"."order_source" AS ENUM('QR', 'POS', 'COUNTER');--> statement-breakpoint
CREATE TYPE "payments"."order_status" AS ENUM('OPEN', 'SENT', 'IN_PREPARATION', 'SERVED', 'PAID', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "payments"."payment_method" AS ENUM('CARD', 'APPLE_PAY', 'GOOGLE_PAY', 'BIZUM', 'ALIPAY_PLUS', 'WECHAT_PAY');--> statement-breakpoint
CREATE TYPE "payments"."payment_qr_status" AS ENUM('ACTIVE', 'REVOKED', 'CONSUMED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "payments"."payment_status" AS ENUM('CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'DISPUTED', 'CHARGED_BACK');--> statement-breakpoint
CREATE TYPE "payments"."transaction_type" AS ENUM('CHARGE', 'REFUND', 'CHARGEBACK', 'CHARGEBACK_REVERSAL', 'PAYOUT', 'FEE');--> statement-breakpoint
CREATE TABLE "platform"."idempotency_keys" (
	"id" uuid PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"status_code" bigint,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform"."outbox_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"aggregate" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "identity"."merchant_user_recovery_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"merchant_user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity"."merchant_users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"merchant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "identity"."merchant_user_role" NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"mfa_secret_enc" text,
	"mfa_enabled_at" timestamp with time zone,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "identity"."user_consents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "identity"."consent_type" NOT NULL,
	"merchant_id" uuid,
	"granted" boolean NOT NULL,
	"version" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity"."users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"phone_e164_enc" text NOT NULL,
	"phone_hash" text NOT NULL,
	"email_enc" text,
	"name" text,
	"birthdate" date,
	"locale" text DEFAULT 'es' NOT NULL,
	"status" "identity"."user_status" DEFAULT 'ACTIVE' NOT NULL,
	"risk_score" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_hash_unique" UNIQUE("phone_hash")
);
--> statement-breakpoint
CREATE TABLE "venues"."merchant_locations" (
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
CREATE TABLE "venues"."merchants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"legal_name" text NOT NULL,
	"tax_id" text NOT NULL,
	"brand_name" text NOT NULL,
	"logo_url" text,
	"status" "venues"."merchant_status" DEFAULT 'ONBOARDING' NOT NULL,
	"psp" text,
	"psp_account_id" text,
	"psp_kyb_status" text,
	"plan_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchants_psp_account_id_unique" UNIQUE("psp_account_id")
);
--> statement-breakpoint
CREATE TABLE "venues"."tables" (
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
CREATE TABLE "venues"."qr_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" "venues"."qr_code_type" NOT NULL,
	"location_id" uuid NOT NULL,
	"table_id" uuid,
	"short_code" text NOT NULL,
	"signature" text NOT NULL,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"expires_at" timestamp with time zone,
	"status" "venues"."qr_code_status" DEFAULT 'ACTIVE' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qr_codes_short_code_unique" UNIQUE("short_code")
);
--> statement-breakpoint
CREATE TABLE "payments"."order_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"pos_line_id" text,
	"name_snapshot" text NOT NULL,
	"qty" integer NOT NULL,
	"unit_price_cents" bigint NOT NULL,
	"modifiers" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments"."orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"location_id" uuid NOT NULL,
	"table_id" uuid,
	"user_id" uuid,
	"source" "payments"."order_source" NOT NULL,
	"status" "payments"."order_status" DEFAULT 'OPEN' NOT NULL,
	"subtotal_cents" bigint DEFAULT 0 NOT NULL,
	"discount_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"pos_external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments"."payment_qr_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"location_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"nonce" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" "payments"."payment_qr_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments"."order_allocations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"pos_line_id" text,
	"units" bigint,
	"amount_cents" bigint NOT NULL,
	"status" "payments"."allocation_status" DEFAULT 'RESERVED' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments"."payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid,
	"location_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"table_id" uuid,
	"qr_code_id" uuid,
	"user_id" uuid,
	"psp" text NOT NULL,
	"psp_payment_id" text,
	"method" "payments"."payment_method",
	"card_last4" text,
	"amount_cents" bigint NOT NULL,
	"tip_cents" bigint DEFAULT 0 NOT NULL,
	"discount_cents" bigint DEFAULT 0 NOT NULL,
	"platform_fee_cents" bigint NOT NULL,
	"psp_fee_cents" bigint,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"status" "payments"."payment_status" DEFAULT 'CREATED' NOT NULL,
	"failure_reason" text,
	"statement_descriptor" text NOT NULL,
	"split_mode" text DEFAULT 'FULL' NOT NULL,
	"guest_session_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"captured_at" timestamp with time zone,
	"pos_registered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_psp_payment_id_unique" UNIQUE("psp_payment_id")
);
--> statement-breakpoint
CREATE TABLE "payments"."psp_webhook_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"psp" text NOT NULL,
	"psp_event_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "payments"."transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_id" uuid NOT NULL,
	"type" "payments"."transaction_type" NOT NULL,
	"amount_cents" bigint NOT NULL,
	"psp_reference" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_psp_reference_unique" UNIQUE("psp_reference")
);
--> statement-breakpoint
CREATE TABLE "payments"."coupon_redemptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"coupon_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"discount_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupon_redemptions_coupon_id_unique" UNIQUE("coupon_id")
);
--> statement-breakpoint
CREATE TABLE "payments"."coupons" (
	"id" uuid PRIMARY KEY NOT NULL,
	"merchant_id" uuid NOT NULL,
	"user_id" uuid,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"discount_cents" bigint NOT NULL,
	"min_spend_cents" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"reserved_payment_id" uuid,
	"reserved_until" timestamp with time zone,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "loyalty"."coupon_issuances" (
	"id" uuid PRIMARY KEY NOT NULL,
	"merchant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"promotion_id" uuid,
	"reward_id" uuid,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"discount_cents" bigint NOT NULL,
	"min_spend_cents" bigint DEFAULT 0 NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone NOT NULL,
	"redeemed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupon_issuances_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "loyalty"."loyalty_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"balance_cached" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty"."loyalty_programs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"merchant_id" uuid NOT NULL,
	"type" text DEFAULT 'POINTS' NOT NULL,
	"earn_rule" jsonb NOT NULL,
	"hold_hours" integer DEFAULT 24 NOT NULL,
	"expiry_days" integer DEFAULT 365 NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_programs_merchant_id_unique" UNIQUE("merchant_id")
);
--> statement-breakpoint
CREATE TABLE "loyalty"."loyalty_rewards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"program_id" uuid NOT NULL,
	"name" text NOT NULL,
	"cost_points" integer NOT NULL,
	"discount_cents" bigint NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty"."points_ledger_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"type" text NOT NULL,
	"points" integer NOT NULL,
	"status" text NOT NULL,
	"payment_id" uuid,
	"coupon_id" uuid,
	"reason" text,
	"created_by" text,
	"available_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty"."promotions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"merchant_id" uuid NOT NULL,
	"template" text NOT NULL,
	"name" text NOT NULL,
	"rules" jsonb NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit"."audit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"ip" text,
	"merchant_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics"."payment_facts" (
	"payment_id" uuid PRIMARY KEY NOT NULL,
	"merchant_id" uuid NOT NULL,
	"user_id" uuid,
	"amount_cents" bigint NOT NULL,
	"discount_cents" bigint NOT NULL,
	"tip_cents" bigint NOT NULL,
	"captured_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fake_pos"."fake_pos_bill_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"bill_id" uuid NOT NULL,
	"name" text NOT NULL,
	"qty" bigint NOT NULL,
	"unit_price_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fake_pos"."fake_pos_bills" (
	"id" uuid PRIMARY KEY NOT NULL,
	"location_id" uuid NOT NULL,
	"external_table_id" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fake_pos"."fake_pos_locations" (
	"location_id" uuid PRIMARY KEY NOT NULL,
	"healthy" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fake_pos"."fake_pos_menu_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"price_cents" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fake_pos"."fake_pos_payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"bill_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"tip_cents" bigint NOT NULL,
	"discount_cents" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fake_psp"."fake_psp_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_id" uuid NOT NULL,
	"merchant_name" text NOT NULL,
	"statement_descriptor" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"platform_fee_cents" bigint NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"return_url" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "identity"."merchant_user_recovery_codes" ADD CONSTRAINT "merchant_user_recovery_codes_merchant_user_id_merchant_users_id_fk" FOREIGN KEY ("merchant_user_id") REFERENCES "identity"."merchant_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."user_consents" ADD CONSTRAINT "user_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues"."merchant_locations" ADD CONSTRAINT "merchant_locations_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "venues"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues"."tables" ADD CONSTRAINT "tables_location_id_merchant_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "venues"."merchant_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues"."qr_codes" ADD CONSTRAINT "qr_codes_location_id_merchant_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "venues"."merchant_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues"."qr_codes" ADD CONSTRAINT "qr_codes_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "venues"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments"."order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "payments"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments"."order_allocations" ADD CONSTRAINT "order_allocations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "payments"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments"."order_allocations" ADD CONSTRAINT "order_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "payments"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments"."payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "payments"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments"."payments" ADD CONSTRAINT "payments_qr_code_id_payment_qr_codes_id_fk" FOREIGN KEY ("qr_code_id") REFERENCES "payments"."payment_qr_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments"."transactions" ADD CONSTRAINT "transactions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "payments"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments"."coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "payments"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments"."coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "payments"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments"."coupons" ADD CONSTRAINT "coupons_reserved_payment_id_payments_id_fk" FOREIGN KEY ("reserved_payment_id") REFERENCES "payments"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty"."coupon_issuances" ADD CONSTRAINT "coupon_issuances_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "loyalty"."promotions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty"."coupon_issuances" ADD CONSTRAINT "coupon_issuances_reward_id_loyalty_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "loyalty"."loyalty_rewards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty"."loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_program_id_loyalty_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "loyalty"."loyalty_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty"."loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_program_id_loyalty_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "loyalty"."loyalty_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty"."points_ledger_entries" ADD CONSTRAINT "points_ledger_entries_account_id_loyalty_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "loyalty"."loyalty_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fake_pos"."fake_pos_bill_items" ADD CONSTRAINT "fake_pos_bill_items_bill_id_fake_pos_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "fake_pos"."fake_pos_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fake_pos"."fake_pos_payments" ADD CONSTRAINT "fake_pos_payments_bill_id_fake_pos_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "fake_pos"."fake_pos_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_keys_scope_key_uq" ON "platform"."idempotency_keys" USING btree ("scope","key");--> statement-breakpoint
CREATE INDEX "outbox_events_unpublished_idx" ON "platform"."outbox_events" USING btree ("created_at") WHERE "platform"."outbox_events"."published_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_user_recovery_codes_uq" ON "identity"."merchant_user_recovery_codes" USING btree ("merchant_user_id","code_hash");--> statement-breakpoint
CREATE INDEX "user_consents_lookup_idx" ON "identity"."user_consents" USING btree ("user_id","type","merchant_id","created_at");--> statement-breakpoint
CREATE INDEX "merchant_locations_merchant_idx" ON "venues"."merchant_locations" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "merchant_locations_geo_idx" ON "venues"."merchant_locations" USING gist ("geo");--> statement-breakpoint
CREATE UNIQUE INDEX "tables_location_label_uq" ON "venues"."tables" USING btree ("location_id","label");--> statement-breakpoint
CREATE INDEX "qr_codes_table_idx" ON "venues"."qr_codes" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "qr_codes_location_idx" ON "venues"."qr_codes" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "qr_codes_one_active_per_table_uq" ON "venues"."qr_codes" USING btree ("table_id") WHERE "venues"."qr_codes"."status" = 'ACTIVE' and "venues"."qr_codes"."type" = 'STATIC_TABLE';--> statement-breakpoint
CREATE UNIQUE INDEX "orders_location_pos_external_uq" ON "payments"."orders" USING btree ("location_id","pos_external_id") WHERE "payments"."orders"."pos_external_id" is not null;--> statement-breakpoint
CREATE INDEX "orders_table_idx" ON "payments"."orders" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "payment_qr_codes_table_idx" ON "payments"."payment_qr_codes" USING btree ("table_id","created_at");--> statement-breakpoint
CREATE INDEX "order_allocations_order_status_idx" ON "payments"."order_allocations" USING btree ("order_id","status");--> statement-breakpoint
CREATE INDEX "order_allocations_payment_idx" ON "payments"."order_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments"."payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_qr_code_idx" ON "payments"."payments" USING btree ("qr_code_id");--> statement-breakpoint
CREATE INDEX "payments_status_expires_idx" ON "payments"."payments" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "psp_webhook_events_psp_event_uq" ON "payments"."psp_webhook_events" USING btree ("psp","psp_event_id");--> statement-breakpoint
CREATE INDEX "coupons_user_merchant_idx" ON "payments"."coupons" USING btree ("user_id","merchant_id","status");--> statement-breakpoint
CREATE INDEX "coupon_issuances_promotion_idx" ON "loyalty"."coupon_issuances" USING btree ("promotion_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_issuances_promotion_user_uq" ON "loyalty"."coupon_issuances" USING btree ("promotion_id","user_id") WHERE "loyalty"."coupon_issuances"."promotion_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_accounts_user_program_uq" ON "loyalty"."loyalty_accounts" USING btree ("user_id","program_id");--> statement-breakpoint
CREATE INDEX "points_ledger_account_idx" ON "loyalty"."points_ledger_entries" USING btree ("account_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "points_ledger_earn_payment_uq" ON "loyalty"."points_ledger_entries" USING btree ("payment_id") WHERE "loyalty"."points_ledger_entries"."type" = 'EARN';--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit"."audit_logs" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_merchant_idx" ON "audit"."audit_logs" USING btree ("merchant_id","id");--> statement-breakpoint
CREATE INDEX "payment_facts_merchant_captured_idx" ON "analytics"."payment_facts" USING btree ("merchant_id","captured_at");--> statement-breakpoint
CREATE INDEX "fake_pos_bills_table_idx" ON "fake_pos"."fake_pos_bills" USING btree ("location_id","external_table_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "fake_pos_payments_reference_uq" ON "fake_pos"."fake_pos_payments" USING btree ("reference");--> statement-breakpoint
-- Añadido a mano (ADR-028): las tablas de solo inserción lo son también en la base de datos. Ni la
-- aplicación ni nadie con sus credenciales puede corregir o borrar una entrada. TRUNCATE (el seed
-- local) no dispara triggers de fila; en producción el rol de la aplicación no tiene ese permiso.
CREATE FUNCTION "platform"."forbid_append_only_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La tabla %.% es de solo inserción (%)', TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "audit_logs_append_only" BEFORE UPDATE OR DELETE ON "audit"."audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "platform"."forbid_append_only_mutation"();--> statement-breakpoint
CREATE TRIGGER "user_consents_append_only" BEFORE UPDATE OR DELETE ON "identity"."user_consents"
  FOR EACH ROW EXECUTE FUNCTION "platform"."forbid_append_only_mutation"();
