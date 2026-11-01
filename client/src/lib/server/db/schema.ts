import {
	pgTable,
	pgEnum,
	uuid,
	text,
	timestamp,
	integer,
	boolean,
	time,
	smallint,
	uniqueIndex,
	index,
	check
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { user } from './auth-schema';
import { MIN_GROUP_SIZE, MAX_GROUP_SIZE } from '../domain/constants';

// ─────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────

export const locationTypeEnum = pgEnum('location_type', [
	'tutor_residence', // in-person at tutor's home — cannot be joined by others
	'classroom', // in-person, joinable
	'online' // joinable
]);

export const sessionStatusEnum = pgEnum('session_status', [
	'open', // accepting bookings/joins
	'locked', // no more joins allowed, awaiting start
	'in_progress',
	'completed', // session happened, awaiting settlement
	'settling', // settlement job actively processing
	'settled', // capture succeeded
	'settlement_failed', // capture failed — needs manual intervention
	'disputed', // refund / dispute opened
	'cancelled'
]);

export const participantStatusEnum = pgEnum('participant_status', [
	'booked', // joined, payment authorized
	'cancelled', // dropped out before session
	'attended', // session completed, participant was in it
	'no_show'
]);

export const paymentStatusEnum = pgEnum('payment_status', [
	'pending', // off-session charge not yet attempted
	'succeeded', // off-session PaymentIntent confirmed
	'failed', // off-session PaymentIntent failed — needs manual intervention
	'refunded',
	'disputed'
]);

export const auStateEnum = pgEnum('au_state', [
	'SA',
	'NSW',
	'VIC',
	'QLD',
	'WA',
	'TAS',
	'ACT',
	'NT'
]);

export const teachingModeEnum = pgEnum('teaching_mode', ['online', 'in_person', 'both']);

// ─────────────────────────────────────────────────────────────
// TUTOR PROFILES
// ─────────────────────────────────────────────────────────────

export const tutorProfiles = pgTable('tutor_profiles', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: text('user_id')
		.notNull()
		.unique()
		.references(() => user.id, { onDelete: 'cascade' }),
	bio: text('bio'),
	state: auStateEnum('state'), // nullable until onboarding completes
	postcode: smallint('postcode'), // nullable until onboarding completes
	teachingMode: teachingModeEnum('teaching_mode'), // nullable until onboarding completes
	headline: text('headline'),
	timezone: text('timezone').notNull().default('Australia/Melbourne'), // IANA tz name — store explicitly per tutor
	stripeAccountId: text('stripe_account_id'), // Stripe Connect Express account — null until onboarding started
	stripeOnboardingComplete: boolean('stripe_onboarding_complete').notNull().default(false), // charges_enabled on the Connect account
	isActive: boolean('is_active').notNull().default(true),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

// ─────────────────────────────────────────────────────────────
// STUDENT PROFILES
// ─────────────────────────────────────────────────────────────

export const studentProfiles = pgTable('student_profiles', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: text('user_id')
		.notNull()
		.unique()
		.references(() => user.id, { onDelete: 'cascade' }),
	yearLevel: smallint('year_level'), // 7-10, nullable until captured
	state: auStateEnum('state'), // nullable until onboarding completes
	postcode: smallint('postcode'), // nullable until onboarding completes
	school: text('school'), // nullable until onboarding completes
	stripeCustomerId: text('stripe_customer_id'), // Stripe Customer — holds saved payment method from the booking SetupIntent
	defaultPaymentMethodId: text('default_payment_method_id'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

// ─────────────────────────────────────────────────────────────
// PRICING TIERS (platform-level — price per student for a given
// published group size once N students have joined)
// ─────────────────────────────────────────────────────────────

export const pricingTiers = pgTable(
	'pricing_tiers',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		groupSize: integer('group_size').notNull(), // max group size chosen by the first booker (2-6)
		participantCount: integer('participant_count').notNull(), // how many students have joined so far (1..groupSize)
		pricePerStudentCents: integer('price_per_student_cents').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('pricing_tier_unique').on(t.groupSize, t.participantCount),
		check(
			'pricing_tier_group_size_check',
			sql`${t.groupSize} >= ${sql.raw(String(MIN_GROUP_SIZE))} AND ${t.groupSize} <= ${sql.raw(String(MAX_GROUP_SIZE))}`
		),
		check(
			'pricing_tier_participant_count_check',
			sql`${t.participantCount} >= 1 AND ${t.participantCount} <= ${t.groupSize}`
		)
	]
);

// ─────────────────────────────────────────────────────────────
// PROCESSED WEBHOOK EVENTS (Stripe webhook idempotency)
// ─────────────────────────────────────────────────────────────

export const processedWebhookEvents = pgTable('processed_webhook_events', {
	id: uuid('id').primaryKey().defaultRandom(),
	stripeEventId: text('stripe_event_id').notNull().unique(),
	eventType: text('event_type').notNull(),
	processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow()
});

export const subjects = pgTable('subjects', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull().unique(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// Join table: which subjects a tutor teaches
export const tutorSubjects = pgTable(
	'tutor_subjects',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		tutorProfileId: uuid('tutor_profile_id')
			.notNull()
			.references(() => tutorProfiles.id, { onDelete: 'cascade' }),
		subjectId: uuid('subject_id')
			.notNull()
			.references(() => subjects.id, { onDelete: 'cascade' })
	},
	(t) => [uniqueIndex('tutor_subject_unique').on(t.tutorProfileId, t.subjectId)]
);

// ─────────────────────────────────────────────────────────────
// AVAILABILITY (recurring template — Phase 1: admin-entered,
// not self-serve; Phase 4 adds tutor self-serve generation)
// ─────────────────────────────────────────────────────────────

export const availabilitySlots = pgTable('availability_slots', {
	id: uuid('id').primaryKey().defaultRandom(),
	tutorProfileId: uuid('tutor_profile_id')
		.notNull()
		.references(() => tutorProfiles.id, { onDelete: 'cascade' }),
	dayOfWeek: smallint('day_of_week').notNull(), // 0 = Sunday .. 6 = Saturday
	startTime: time('start_time').notNull(), // stored in tutor's local time
	endTime: time('end_time').notNull(),
	defaultLocationType: locationTypeEnum('default_location_type').notNull(),
	groupSizeLimit: integer('group_size_limit').notNull().default(1),
	isActive: boolean('is_active').notNull().default(true),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// ─────────────────────────────────────────────────────────────
// SESSIONS (concrete bookable occurrence — deliberately separate
// from the template above, per your original data model)
// ─────────────────────────────────────────────────────────────

export const sessions = pgTable(
	'sessions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		tutorProfileId: uuid('tutor_profile_id')
			.notNull()
			.references(() => tutorProfiles.id, { onDelete: 'restrict' }),
		subjectId: uuid('subject_id')
			.notNull()
			.references(() => subjects.id, { onDelete: 'restrict' }),
		availabilitySlotId: uuid('availability_slot_id').references(() => availabilitySlots.id, {
			onDelete: 'set null'
		}), // nullable — a session can exist without a recurring template origin

		// Stored in UTC; render in tutor/student local time at the edges (see conversation notes on timezones)
		startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
		endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),

		locationType: locationTypeEnum('location_type').notNull(), // set by first booker, per your spec
		groupSizeLimit: integer('group_size_limit').notNull(), // set by first booker, must be 2-6 (D7)

		status: sessionStatusEnum('status').notNull().default('open'),

		// When this session stops accepting new joiners (D1: 24h before startsAt by
		// default). Set once the first booker creates the session.
		lockAt: timestamp('lock_at', { withTimezone: true }).notNull(),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('sessions_tutor_starts_at_idx').on(t.tutorProfileId, t.startsAt),
		index('sessions_status_idx').on(t.status),
		check(
			'sessions_group_size_limit_check',
			sql`${t.groupSizeLimit} >= ${sql.raw(String(MIN_GROUP_SIZE))} AND ${t.groupSizeLimit} <= ${sql.raw(String(MAX_GROUP_SIZE))}`
		)
	]
);

// ─────────────────────────────────────────────────────────────
// SESSION PARTICIPANTS
// ─────────────────────────────────────────────────────────────

export const sessionParticipants = pgTable(
	'session_participants',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		sessionId: uuid('session_id')
			.notNull()
			.references(() => sessions.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),

		isFirstBooker: boolean('is_first_booker').notNull().default(false), // sets group size + location

		status: participantStatusEnum('status').notNull().default('booked'),

		// Money: always integer cents (AUD), never float.
		// Snapshot of the live per-student price at the moment this student joined —
		// shown back to them as "what you'll pay if the group doesn't grow".
		priceExpectedCents: integer('price_expected_cents').notNull(),
		// The actual amount charged once the session locks and the final
		// participant count is known. Null until the session locks.
		priceFinalCents: integer('price_final_cents'),

		joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
		cancelledAt: timestamp('cancelled_at', { withTimezone: true })
	},
	(t) => [
		uniqueIndex('session_participant_unique').on(t.sessionId, t.userId),
		index('session_participants_session_idx').on(t.sessionId)
	]
);

// ─────────────────────────────────────────────────────────────
// PAYMENTS (Stripe references — SetupIntent-at-booking, then an
// off-session PaymentIntent per participant once the tutor marks
// the session complete. No pre-authorization/hold.)
// ─────────────────────────────────────────────────────────────

export const payments = pgTable(
	'payments',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		sessionParticipantId: uuid('session_participant_id')
			.notNull()
			.unique()
			.references(() => sessionParticipants.id, { onDelete: 'restrict' }),

		// Null until the off-session charge attempt actually creates a PaymentIntent.
		stripePaymentIntentId: text('stripe_payment_intent_id').unique(),

		// Money: integer cents (AUD). Total charged to the student, and its split
		// via a Stripe Connect Express destination charge with application_fee_amount.
		amountCents: integer('amount_cents').notNull(),
		platformFeeCents: integer('platform_fee_cents').notNull(), // application_fee_amount (10%, from tutor's share — D3)
		tutorAmountCents: integer('tutor_amount_cents').notNull(), // amountCents - platformFeeCents

		status: paymentStatusEnum('status').notNull().default('pending'),

		chargedAt: timestamp('charged_at', { withTimezone: true }), // set when the PaymentIntent succeeds
		failureReason: text('failure_reason'), // populated on failed — surfaced to admin

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('payments_status_idx').on(t.status)]
);

// ─────────────────────────────────────────────────────────────
// PAYOUTS — table shape defined now, unused until Phase 4
// (Stripe Connect, multi-tutor). Kept here so the migration
// history doesn't need a disruptive schema change later, but
// no application code should write to this table in Phase 1.
// ─────────────────────────────────────────────────────────────

export const payouts = pgTable('payouts', {
	id: uuid('id').primaryKey().defaultRandom(),
	tutorProfileId: uuid('tutor_profile_id')
		.notNull()
		.references(() => tutorProfiles.id, { onDelete: 'restrict' }),
	stripeTransferId: text('stripe_transfer_id').unique(),
	amountCents: integer('amount_cents').notNull(),
	periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
	periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// ─────────────────────────────────────────────────────────────
// RELATIONS (for Drizzle's relational query API — db.query.sessions.findMany({ with: {...} }))
// ─────────────────────────────────────────────────────────────

export const tutorProfilesRelations = relations(tutorProfiles, ({ one, many }) => ({
	user: one(user, { fields: [tutorProfiles.userId], references: [user.id] }),
	availabilitySlots: many(availabilitySlots),
	sessions: many(sessions),
	tutorSubjects: many(tutorSubjects),
	payouts: many(payouts)
}));

export const studentProfilesRelations = relations(studentProfiles, ({ one }) => ({
	user: one(user, { fields: [studentProfiles.userId], references: [user.id] })
}));

export const subjectsRelations = relations(subjects, ({ many }) => ({
	tutorSubjects: many(tutorSubjects),
	availabilitySlots: many(availabilitySlots),
	sessions: many(sessions)
}));

export const tutorSubjectsRelations = relations(tutorSubjects, ({ one }) => ({
	tutorProfile: one(tutorProfiles, {
		fields: [tutorSubjects.tutorProfileId],
		references: [tutorProfiles.id]
	}),
	subject: one(subjects, { fields: [tutorSubjects.subjectId], references: [subjects.id] })
}));

export const availabilitySlotsRelations = relations(availabilitySlots, ({ one, many }) => ({
	tutorProfile: one(tutorProfiles, {
		fields: [availabilitySlots.tutorProfileId],
		references: [tutorProfiles.id]
	}),
	sessions: many(sessions)
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
	tutorProfile: one(tutorProfiles, {
		fields: [sessions.tutorProfileId],
		references: [tutorProfiles.id]
	}),
	subject: one(subjects, { fields: [sessions.subjectId], references: [subjects.id] }),
	availabilitySlot: one(availabilitySlots, {
		fields: [sessions.availabilitySlotId],
		references: [availabilitySlots.id]
	}),
	participants: many(sessionParticipants)
}));

export const sessionParticipantsRelations = relations(sessionParticipants, ({ one }) => ({
	session: one(sessions, { fields: [sessionParticipants.sessionId], references: [sessions.id] }),
	user: one(user, { fields: [sessionParticipants.userId], references: [user.id] }),
	payment: one(payments, {
		fields: [sessionParticipants.id],
		references: [payments.sessionParticipantId]
	})
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
	sessionParticipant: one(sessionParticipants, {
		fields: [payments.sessionParticipantId],
		references: [sessionParticipants.id]
	})
}));

export const payoutsRelations = relations(payouts, ({ one }) => ({
	tutorProfile: one(tutorProfiles, {
		fields: [payouts.tutorProfileId],
		references: [tutorProfiles.id]
	})
}));

export * from './auth-schema';
