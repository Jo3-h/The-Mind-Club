CREATE TABLE "pricing_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_size" integer NOT NULL,
	"participant_count" integer NOT NULL,
	"price_per_student_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pricing_tier_group_size_check" CHECK ("pricing_tiers"."group_size" >= 2 AND "pricing_tiers"."group_size" <= 6),
	CONSTRAINT "pricing_tier_participant_count_check" CHECK ("pricing_tiers"."participant_count" >= 1 AND "pricing_tiers"."participant_count" <= "pricing_tiers"."group_size")
);
--> statement-breakpoint
CREATE TABLE "processed_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "processed_webhook_events_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
CREATE TABLE "student_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"year_level" smallint,
	"stripe_customer_id" text,
	"default_payment_method_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "payouts" RENAME COLUMN "amount" TO "amount_cents";--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."payment_status";--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded', 'disputed');--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."payment_status";--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "status" SET DATA TYPE "public"."payment_status" USING "status"::"public"."payment_status";--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "stripe_payment_intent_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "group_size_limit" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "amount_cents" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "platform_fee_cents" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "tutor_amount_cents" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "charged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "session_participants" ADD COLUMN "price_expected_cents" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "session_participants" ADD COLUMN "price_final_cents" integer;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "lock_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "tutor_profiles" ADD COLUMN "stripe_onboarding_complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "amount_authorized";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "amount_captured";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "authorized_at";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "captured_at";--> statement-breakpoint
ALTER TABLE "session_participants" DROP COLUMN "price_authorized";--> statement-breakpoint
ALTER TABLE "session_participants" DROP COLUMN "price_captured";--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_group_size_limit_check" CHECK ("sessions"."group_size_limit" >= 2 AND "sessions"."group_size_limit" <= 6);