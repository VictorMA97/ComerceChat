CREATE TYPE "public"."order_source" AS ENUM('QR', 'POS', 'COUNTER');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('OPEN', 'SENT', 'IN_PREPARATION', 'SERVED', 'PAID', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('CARD', 'APPLE_PAY', 'GOOGLE_PAY', 'BIZUM', 'ALIPAY_PLUS', 'WECHAT_PAY');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'DISPUTED', 'CHARGED_BACK');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('CHARGE', 'REFUND', 'CHARGEBACK', 'CHARGEBACK_REVERSAL', 'PAYOUT', 'FEE');--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"name_snapshot" text NOT NULL,
	"qty" integer NOT NULL,
	"unit_price_cents" bigint NOT NULL,
	"modifiers" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"location_id" uuid NOT NULL,
	"table_id" uuid,
	"user_id" uuid,
	"source" "order_source" NOT NULL,
	"status" "order_status" DEFAULT 'OPEN' NOT NULL,
	"subtotal_cents" bigint DEFAULT 0 NOT NULL,
	"discount_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"pos_external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
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
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid,
	"location_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"table_id" uuid,
	"user_id" uuid,
	"psp" text NOT NULL,
	"psp_payment_id" text,
	"method" "payment_method",
	"card_last4" text,
	"amount_cents" bigint NOT NULL,
	"tip_cents" bigint DEFAULT 0 NOT NULL,
	"discount_cents" bigint DEFAULT 0 NOT NULL,
	"platform_fee_cents" bigint NOT NULL,
	"psp_fee_cents" bigint,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"status" "payment_status" DEFAULT 'CREATED' NOT NULL,
	"failure_reason" text,
	"statement_descriptor" text NOT NULL,
	"guest_session_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"captured_at" timestamp with time zone,
	"pos_registered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_psp_payment_id_unique" UNIQUE("psp_payment_id")
);
--> statement-breakpoint
CREATE TABLE "psp_webhook_events" (
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
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_id" uuid NOT NULL,
	"type" "transaction_type" NOT NULL,
	"amount_cents" bigint NOT NULL,
	"psp_reference" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_psp_reference_unique" UNIQUE("psp_reference")
);
--> statement-breakpoint
CREATE TABLE "fake_pos_bill_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"bill_id" uuid NOT NULL,
	"name" text NOT NULL,
	"qty" bigint NOT NULL,
	"unit_price_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fake_pos_bills" (
	"id" uuid PRIMARY KEY NOT NULL,
	"location_id" uuid NOT NULL,
	"external_table_id" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fake_pos_locations" (
	"location_id" uuid PRIMARY KEY NOT NULL,
	"healthy" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fake_pos_menu_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"price_cents" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fake_pos_payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"bill_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"tip_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fake_psp_sessions" (
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
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_location_id_merchant_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."merchant_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_location_id_merchant_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."merchant_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fake_pos_bill_items" ADD CONSTRAINT "fake_pos_bill_items_bill_id_fake_pos_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."fake_pos_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fake_pos_bills" ADD CONSTRAINT "fake_pos_bills_location_id_merchant_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."merchant_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fake_pos_locations" ADD CONSTRAINT "fake_pos_locations_location_id_merchant_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."merchant_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fake_pos_menu_items" ADD CONSTRAINT "fake_pos_menu_items_location_id_merchant_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."merchant_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fake_pos_payments" ADD CONSTRAINT "fake_pos_payments_bill_id_fake_pos_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."fake_pos_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_location_pos_external_uq" ON "orders" USING btree ("location_id","pos_external_id") WHERE "orders"."pos_external_id" is not null;--> statement-breakpoint
CREATE INDEX "orders_table_idx" ON "orders" USING btree ("table_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_keys_scope_key_uq" ON "idempotency_keys" USING btree ("scope","key");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_status_expires_idx" ON "payments" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "psp_webhook_events_psp_event_uq" ON "psp_webhook_events" USING btree ("psp","psp_event_id");--> statement-breakpoint
CREATE INDEX "fake_pos_bills_table_idx" ON "fake_pos_bills" USING btree ("location_id","external_table_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "fake_pos_payments_reference_uq" ON "fake_pos_payments" USING btree ("reference");