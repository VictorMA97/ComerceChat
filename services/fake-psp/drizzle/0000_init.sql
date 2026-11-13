-- Corregido a mano (ADR-019): el migrador crea el esquema antes, para su tabla de control
-- (migrationsSchema: fake_psp), así que aquí puede existir ya.
CREATE SCHEMA IF NOT EXISTS "fake_psp";
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
	"notify_url" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
