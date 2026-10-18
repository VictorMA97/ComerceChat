CREATE TYPE "public"."allocation_status" AS ENUM('RESERVED', 'PAID', 'RELEASED');--> statement-breakpoint
CREATE TABLE "order_allocations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"pos_line_id" text,
	"units" bigint,
	"amount_cents" bigint NOT NULL,
	"status" "allocation_status" DEFAULT 'RESERVED' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "pos_line_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "qr_code_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "split_mode" text DEFAULT 'FULL' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_allocations" ADD CONSTRAINT "order_allocations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_allocations" ADD CONSTRAINT "order_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_allocations_order_status_idx" ON "order_allocations" USING btree ("order_id","status");--> statement-breakpoint
CREATE INDEX "order_allocations_payment_idx" ON "order_allocations" USING btree ("payment_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_qr_code_id_qr_codes_id_fk" FOREIGN KEY ("qr_code_id") REFERENCES "public"."qr_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_qr_code_idx" ON "payments" USING btree ("qr_code_id");