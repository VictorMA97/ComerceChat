CREATE TABLE "merchant_user_recovery_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"merchant_user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchant_users" ADD COLUMN "mfa_secret_enc" text;--> statement-breakpoint
ALTER TABLE "merchant_users" ADD COLUMN "mfa_enabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "merchant_user_recovery_codes" ADD CONSTRAINT "merchant_user_recovery_codes_merchant_user_id_merchant_users_id_fk" FOREIGN KEY ("merchant_user_id") REFERENCES "public"."merchant_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_user_recovery_codes_uq" ON "merchant_user_recovery_codes" USING btree ("merchant_user_id","code_hash");