CREATE TABLE "coupon_redemptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"coupon_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"discount_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupon_redemptions_coupon_id_unique" UNIQUE("coupon_id")
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY NOT NULL,
	"merchant_id" uuid NOT NULL,
	"user_id" uuid,
	"promotion_id" uuid,
	"reward_id" uuid,
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
CREATE TABLE "loyalty_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"balance_cached" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_programs" (
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
CREATE TABLE "loyalty_rewards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"program_id" uuid NOT NULL,
	"name" text NOT NULL,
	"cost_points" integer NOT NULL,
	"discount_cents" bigint NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "points_ledger_entries" (
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
CREATE TABLE "promotions" (
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
ALTER TABLE "fake_pos_payments" ADD COLUMN "discount_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_reward_id_loyalty_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."loyalty_rewards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_reserved_payment_id_payments_id_fk" FOREIGN KEY ("reserved_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_program_id_loyalty_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."loyalty_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_programs" ADD CONSTRAINT "loyalty_programs_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_program_id_loyalty_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."loyalty_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_ledger_entries" ADD CONSTRAINT "points_ledger_entries_account_id_loyalty_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."loyalty_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_ledger_entries" ADD CONSTRAINT "points_ledger_entries_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coupons_user_merchant_idx" ON "coupons" USING btree ("user_id","merchant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_promotion_user_uq" ON "coupons" USING btree ("promotion_id","user_id") WHERE "coupons"."promotion_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_accounts_user_program_uq" ON "loyalty_accounts" USING btree ("user_id","program_id");--> statement-breakpoint
CREATE INDEX "points_ledger_account_idx" ON "points_ledger_entries" USING btree ("account_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "points_ledger_earn_payment_uq" ON "points_ledger_entries" USING btree ("payment_id") WHERE "points_ledger_entries"."type" = 'EARN';