-- Corregido a mano (ADR-019): el migrador crea el esquema antes, para su tabla de control
-- (migrationsSchema: fake_pos), así que aquí puede existir ya.
CREATE SCHEMA IF NOT EXISTS "fake_pos";
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
ALTER TABLE "fake_pos"."fake_pos_bill_items" ADD CONSTRAINT "fake_pos_bill_items_bill_id_fake_pos_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "fake_pos"."fake_pos_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fake_pos"."fake_pos_payments" ADD CONSTRAINT "fake_pos_payments_bill_id_fake_pos_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "fake_pos"."fake_pos_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fake_pos_bills_table_idx" ON "fake_pos"."fake_pos_bills" USING btree ("location_id","external_table_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "fake_pos_payments_reference_uq" ON "fake_pos"."fake_pos_payments" USING btree ("reference");