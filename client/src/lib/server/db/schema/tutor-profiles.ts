import { pgTable, text, char, smallint, integer, boolean, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tstz, timestamps } from './_columns';
import { auState, teachingMode, tutorStatus, wwccStatus } from './enums';
import { user } from '../auth-schema';

/**
 * One row per tutor, 1:1 with `user` (user.role = 'tutor').
 *
 * BOOKABLE when ALL hold (check in one repository function, e.g. Tutor.isBookable):
 *   status = 'active'  ·  ≥1 tutor_topics row  ·  ≥1 weekly_availability row
 *   stripe_payouts_enabled  ·  wwcc_status = 'verified'
 */
export const tutorProfiles = pgTable(
	'tutor_profiles',
	{
		userId: text('user_id')
			.primaryKey()
			.references(() => user.id, { onDelete: 'cascade' }),
		status: tutorStatus('status').notNull().default('onboarding'),

		// ---- public profile ----
		headline: text('headline'),
		bio: text('bio'),

		// ---- where & how ----
		state: auState('state'),
		/** IANA zone, e.g. "Australia/Adelaide". Their weekly availability is in this zone. */
		timezone: text('timezone').notNull().default('Australia/Adelaide'),
		teachingMode: teachingMode('teaching_mode'),
		postcode: char('postcode', { length: 4 }),
		travelRadiusKm: smallint('travel_radius_km'),

		// ---- group & price ----
		/** Ceiling for any session they run. Each session snapshots its own capacity ≤ this. */
		maxGroupSize: smallint('max_group_size').notNull().default(4),
		/**
		 * Price of 1 student × 60 minutes, in cents (AUD). The platform pricing scheme discounts
		 * from this as the group grows. Each session snapshots it, so changing it never reprices
		 * existing sessions.
		 */
		baseRateCents: integer('base_rate_cents'),

		// ---- online sessions ----
		/**
		 * The tutor's standing room (Zoom personal room, Meet, Teams…). Used for their online
		 * sessions unless a session sets its own. Only revealed through /sessions/[id]/join.
		 */
		meetingUrl: text('meeting_url'),

		// ---- Working With Children Check ----
		wwccNumber: text('wwcc_number'),
		wwccState: auState('wwcc_state'),
		wwccStatus: wwccStatus('wwcc_status').notNull().default('not_provided'),
		wwccVerifiedAt: tstz('wwcc_verified_at'),
		wwccExpiresAt: tstz('wwcc_expires_at'),

		// ---- Stripe Connect (Express) — written by the server/webhooks only ----
		stripeAccountId: text('stripe_account_id').unique(),
		stripeDetailsSubmitted: boolean('stripe_details_submitted').notNull().default(false),
		stripeChargesEnabled: boolean('stripe_charges_enabled').notNull().default(false),
		stripePayoutsEnabled: boolean('stripe_payouts_enabled').notNull().default(false),

		onboardingCompletedAt: tstz('onboarding_completed_at'),
		...timestamps()
	},
	(t) => [
		index('tutor_profiles_status_idx').on(t.status),
		check('tutor_max_group_chk', sql`${t.maxGroupSize} between 1 and 20`),
		check('tutor_base_rate_chk', sql`${t.baseRateCents} is null or ${t.baseRateCents} > 0`),
		// in-person tutors must say where they are once onboarding is done
		check(
			'tutor_location_chk',
			sql`${t.onboardingCompletedAt} is null or ${t.teachingMode} = 'online'
				or (${t.postcode} is not null and ${t.travelRadiusKm} is not null)`
		)
	]
);
