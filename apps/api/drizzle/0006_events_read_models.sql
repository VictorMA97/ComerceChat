CREATE TABLE "coupon_issuances" (
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
CREATE TABLE "payment_facts" (
	"payment_id" uuid PRIMARY KEY NOT NULL,
	"merchant_id" uuid NOT NULL,
	"user_id" uuid,
	"amount_cents" bigint NOT NULL,
	"discount_cents" bigint NOT NULL,
	"tip_cents" bigint NOT NULL,
	"captured_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coupons" DROP CONSTRAINT "coupons_promotion_id_promotions_id_fk";
--> statement-breakpoint
ALTER TABLE "coupons" DROP CONSTRAINT "coupons_reward_id_loyalty_rewards_id_fk";
--> statement-breakpoint
DROP INDEX "coupons_promotion_user_uq";--> statement-breakpoint
ALTER TABLE "coupon_issuances" ADD CONSTRAINT "coupon_issuances_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_issuances" ADD CONSTRAINT "coupon_issuances_reward_id_loyalty_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."loyalty_rewards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coupon_issuances_promotion_idx" ON "coupon_issuances" USING btree ("promotion_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_issuances_promotion_user_uq" ON "coupon_issuances" USING btree ("promotion_id","user_id") WHERE "coupon_issuances"."promotion_id" is not null;--> statement-breakpoint
CREATE INDEX "payment_facts_merchant_captured_idx" ON "payment_facts" USING btree ("merchant_id","captured_at");--> statement-breakpoint
ALTER TABLE "coupons" DROP COLUMN "promotion_id";--> statement-breakpoint
ALTER TABLE "coupons" DROP COLUMN "reward_id";