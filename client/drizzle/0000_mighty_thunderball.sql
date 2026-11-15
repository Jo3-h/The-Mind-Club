CREATE TYPE "public"."au_state" AS ENUM('SA', 'NSW', 'VIC', 'QLD', 'WA', 'TAS', 'ACT', 'NT');--> statement-breakpoint
CREATE TYPE "public"."availability_exception_kind" AS ENUM('blocked', 'extra');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending', 'confirmed', 'cancelled', 'attended', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."delivery_preference" AS ENUM('online', 'in_person', 'either');--> statement-breakpoint
CREATE TYPE "public"."group_preference" AS ENUM('any', 'small', 'one_on_one');--> statement-breakpoint
CREATE TYPE "public"."location_type" AS ENUM('online', 'tutor_venue', 'public_venue', 'student_home');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('requires_action', 'card_saved', 'authorized', 'captured', 'partially_refunded', 'refunded', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."series_status" AS ENUM('active', 'ended');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('scheduled', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."session_visibility" AS ENUM('open', 'private');--> statement-breakpoint
CREATE TYPE "public"."teaching_mode" AS ENUM('online', 'in_person', 'both');--> statement-breakpoint
CREATE TYPE "public"."tutor_status" AS ENUM('onboarding', 'active', 'paused', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."wwcc_status" AS ENUM('not_provided', 'pending', 'verified', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'tutor', 'admin');--> statement-breakpoint
CREATE TABLE "postcodes" (
	"postcode" char(4) NOT NULL,
	"suburb" text NOT NULL,
	"state" "au_state" NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	CONSTRAINT "postcodes_postcode_suburb_pk" PRIMARY KEY("postcode","suburb")
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subjects_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"year_level" smallint NOT NULL,
	"state" "au_state",
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_key_unique" UNIQUE("key"),
	CONSTRAINT "courses_year_level_chk" CHECK ("courses"."year_level" between 7 and 12)
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"title" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topics_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "course_topics" (
	"course_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"chapter_number" smallint NOT NULL,
	CONSTRAINT "course_topics_course_id_topic_id_pk" PRIMARY KEY("course_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "tutor_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"status" "tutor_status" DEFAULT 'onboarding' NOT NULL,
	"headline" text,
	"bio" text,
	"state" "au_state",
	"timezone" text DEFAULT 'Australia/Adelaide' NOT NULL,
	"teaching_mode" "teaching_mode",
	"postcode" char(4),
	"travel_radius_km" smallint,
	"max_group_size" smallint DEFAULT 4 NOT NULL,
	"base_rate_cents" integer,
	"wwcc_number" text,
	"wwcc_state" "au_state",
	"wwcc_status" "wwcc_status" DEFAULT 'not_provided' NOT NULL,
	"wwcc_verified_at" timestamp with time zone,
	"wwcc_expires_at" timestamp with time zone,
	"stripe_account_id" text,
	"stripe_details_submitted" boolean DEFAULT false NOT NULL,
	"stripe_charges_enabled" boolean DEFAULT false NOT NULL,
	"stripe_payouts_enabled" boolean DEFAULT false NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tutor_profiles_stripe_account_id_unique" UNIQUE("stripe_account_id"),
	CONSTRAINT "tutor_max_group_chk" CHECK ("tutor_profiles"."max_group_size" between 1 and 20),
	CONSTRAINT "tutor_base_rate_chk" CHECK ("tutor_profiles"."base_rate_cents" is null or "tutor_profiles"."base_rate_cents" > 0),
	CONSTRAINT "tutor_location_chk" CHECK ("tutor_profiles"."onboarding_completed_at" is null or "tutor_profiles"."teaching_mode" = 'online'
				or ("tutor_profiles"."postcode" is not null and "tutor_profiles"."travel_radius_km" is not null))
);
--> statement-breakpoint
CREATE TABLE "student_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"state" "au_state",
	"timezone" text DEFAULT 'Australia/Adelaide' NOT NULL,
	"postcode" char(4),
	"school" text,
	"graduation_year" smallint,
	"delivery_preference" "delivery_preference",
	"group_preference" "group_preference" DEFAULT 'any' NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_location_chk" CHECK ("student_profiles"."onboarding_completed_at" is null or "student_profiles"."delivery_preference" = 'online' or "student_profiles"."postcode" is not null)
);
--> statement-breakpoint
CREATE TABLE "tutor_topics" (
	"tutor_id" text NOT NULL,
	"topic_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tutor_topics_tutor_id_topic_id_pk" PRIMARY KEY("tutor_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "student_topics" (
	"student_id" text NOT NULL,
	"topic_id" uuid NOT NULL,
	"needed_by" date,
	"notify_requested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_topics_student_id_topic_id_pk" PRIMARY KEY("student_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "weekly_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"weekday" smallint NOT NULL,
	"start_minute" smallint NOT NULL,
	"end_minute" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wa_weekday_chk" CHECK ("weekly_availability"."weekday" between 1 and 7),
	CONSTRAINT "wa_range_chk" CHECK ("weekly_availability"."start_minute" >= 0 and "weekly_availability"."end_minute" <= 1440 and "weekly_availability"."end_minute" > "weekly_availability"."start_minute")
);
--> statement-breakpoint
CREATE TABLE "availability_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" "availability_exception_kind" DEFAULT 'blocked' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ae_range_chk" CHECK ("availability_exceptions"."ends_at" > "availability_exceptions"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "pricing_schemes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"platform_fee_bps" integer NOT NULL,
	"active_from" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ps_fee_chk" CHECK ("pricing_schemes"."platform_fee_bps" between 0 and 10000)
);
--> statement-breakpoint
CREATE TABLE "pricing_tiers" (
	"scheme_id" uuid NOT NULL,
	"group_size" smallint NOT NULL,
	"multiplier_bps" integer NOT NULL,
	CONSTRAINT "pricing_tiers_scheme_id_group_size_pk" PRIMARY KEY("scheme_id","group_size"),
	CONSTRAINT "pt_size_chk" CHECK ("pricing_tiers"."group_size" >= 1),
	CONSTRAINT "pt_mult_chk" CHECK ("pricing_tiers"."multiplier_bps" between 1 and 10000)
);
--> statement-breakpoint
CREATE TABLE "session_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_id" text NOT NULL,
	"status" "series_status" DEFAULT 'active' NOT NULL,
	"weekday" smallint NOT NULL,
	"start_minute" smallint NOT NULL,
	"duration_minutes" smallint NOT NULL,
	"timezone" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"capacity" smallint NOT NULL,
	"visibility" "session_visibility" DEFAULT 'open' NOT NULL,
	"location_type" "location_type" NOT NULL,
	"suburb" text,
	"postcode" char(4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ss_weekday_chk" CHECK ("session_series"."weekday" between 1 and 7),
	CONSTRAINT "ss_duration_chk" CHECK ("session_series"."duration_minutes" > 0),
	CONSTRAINT "ss_capacity_chk" CHECK ("session_series"."capacity" >= 1)
);
--> statement-breakpoint
CREATE TABLE "tutoring_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_id" text NOT NULL,
	"series_id" uuid,
	"topic_id" uuid NOT NULL,
	"course_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"location_type" "location_type" NOT NULL,
	"suburb" text,
	"postcode" char(4),
	"address_line" text,
	"meeting_url" text,
	"capacity" smallint NOT NULL,
	"visibility" "session_visibility" DEFAULT 'open' NOT NULL,
	"base_rate_cents" integer NOT NULL,
	"pricing_scheme_id" uuid NOT NULL,
	"status" "session_status" DEFAULT 'scheduled' NOT NULL,
	"created_by_user_id" text,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ts_time_chk" CHECK ("tutoring_sessions"."ends_at" > "tutoring_sessions"."starts_at"),
	CONSTRAINT "ts_capacity_chk" CHECK ("tutoring_sessions"."capacity" >= 1),
	CONSTRAINT "ts_home_private_chk" CHECK ("tutoring_sessions"."location_type" <> 'student_home' or "tutoring_sessions"."visibility" = 'private')
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"student_id" text NOT NULL,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone,
	"price_cap_cents" integer NOT NULL,
	"final_price_cents" integer,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_user_id" text,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"payer_user_id" text NOT NULL,
	"status" "payment_status" NOT NULL,
	"currency" char(3) DEFAULT 'aud' NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_setup_intent_id" text,
	"stripe_payment_method_id" text,
	"stripe_destination_account_id" text,
	"amount_authorized_cents" integer,
	"amount_captured_cents" integer,
	"application_fee_cents" integer,
	"amount_refunded_cents" integer DEFAULT 0 NOT NULL,
	"failure_code" text,
	"failure_message" text,
	"authorized_at" timestamp with time zone,
	"captured_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id"),
	CONSTRAINT "payments_stripe_setup_intent_id_unique" UNIQUE("stripe_setup_intent_id"),
	CONSTRAINT "payments_amounts_chk" CHECK (coalesce("payments"."amount_captured_cents", 0) >= 0 and "payments"."amount_refunded_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'student' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_topics" ADD CONSTRAINT "course_topics_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_topics" ADD CONSTRAINT "course_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_profiles" ADD CONSTRAINT "tutor_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_topics" ADD CONSTRAINT "tutor_topics_tutor_id_tutor_profiles_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutor_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_topics" ADD CONSTRAINT "tutor_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_topics" ADD CONSTRAINT "student_topics_student_id_student_profiles_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_topics" ADD CONSTRAINT "student_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_availability" ADD CONSTRAINT "weekly_availability_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_tiers" ADD CONSTRAINT "pricing_tiers_scheme_id_pricing_schemes_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."pricing_schemes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_series" ADD CONSTRAINT "session_series_tutor_id_tutor_profiles_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutor_profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutoring_sessions" ADD CONSTRAINT "tutoring_sessions_tutor_id_tutor_profiles_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutor_profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutoring_sessions" ADD CONSTRAINT "tutoring_sessions_series_id_session_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."session_series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutoring_sessions" ADD CONSTRAINT "tutoring_sessions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutoring_sessions" ADD CONSTRAINT "tutoring_sessions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutoring_sessions" ADD CONSTRAINT "tutoring_sessions_pricing_scheme_id_pricing_schemes_id_fk" FOREIGN KEY ("pricing_scheme_id") REFERENCES "public"."pricing_schemes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutoring_sessions" ADD CONSTRAINT "tutoring_sessions_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_session_id_tutoring_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."tutoring_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_student_id_student_profiles_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student_profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_by_user_id_user_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_user_id_user_id_fk" FOREIGN KEY ("payer_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "postcodes_postcode_idx" ON "postcodes" USING btree ("postcode");--> statement-breakpoint
CREATE INDEX "courses_lookup_idx" ON "courses" USING btree ("year_level","state");--> statement-breakpoint
CREATE INDEX "topics_subject_idx" ON "topics" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "course_topics_topic_idx" ON "course_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "tutor_profiles_status_idx" ON "tutor_profiles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tutor_topics_topic_idx" ON "tutor_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "student_topics_topic_idx" ON "student_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "weekly_availability_user_idx" ON "weekly_availability" USING btree ("user_id","weekday");--> statement-breakpoint
CREATE INDEX "availability_exceptions_user_idx" ON "availability_exceptions" USING btree ("user_id","starts_at");--> statement-breakpoint
CREATE INDEX "session_series_tutor_idx" ON "session_series" USING btree ("tutor_id");--> statement-breakpoint
CREATE INDEX "ts_tutor_time_idx" ON "tutoring_sessions" USING btree ("tutor_id","starts_at");--> statement-breakpoint
CREATE INDEX "ts_open_topic_time_idx" ON "tutoring_sessions" USING btree ("topic_id","starts_at") WHERE "tutoring_sessions"."status" = 'scheduled' and "tutoring_sessions"."visibility" = 'open';--> statement-breakpoint
CREATE INDEX "ts_series_idx" ON "tutoring_sessions" USING btree ("series_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_one_live_per_student_idx" ON "bookings" USING btree ("session_id","student_id") WHERE "bookings"."status" <> 'cancelled';--> statement-breakpoint
CREATE INDEX "bookings_session_idx" ON "bookings" USING btree ("session_id","status");--> statement-breakpoint
CREATE INDEX "bookings_student_idx" ON "bookings" USING btree ("student_id","status");--> statement-breakpoint
CREATE INDEX "payments_booking_idx" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");