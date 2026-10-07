import {
	pgTable,
	pgEnum,
	uuid,
	text,
	timestamp,
	integer,
	numeric,
	boolean,
	time,
	smallint,
	uniqueIndex,
	index
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from './auth-schema';

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
	'authorized', // hold placed, not yet captured
	'captured', // settlement succeeded
	'capture_failed', // settlement attempt failed
	'refunded',
	'disputed'
]);

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
	timezone: text('timezone').notNull().default('Australia/Melbourne'), // IANA tz name — store explicitly per tutor
	stripeAccountId: text('stripe_account_id'), // Stripe Connect account — null until Phase 4 multi-tutor
	isActive: boolean('is_active').notNull().default(true),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
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
	(t) => [
		{
			uniqueTutorSubject: uniqueIndex('tutor_subject_unique').on(t.tutorProfileId, t.subjectId)
		}
	]
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
		groupSizeLimit: integer('group_size_limit').notNull().default(1), // set by first booker

		status: sessionStatusEnum('status').notNull().default('open'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		{ tutorStartsAtIdx: index('sessions_tutor_starts_at_idx').on(t.tutorProfileId, t.startsAt) },
		{ statusIdx: index('sessions_status_idx').on(t.status) }
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

		// Money: always numeric, never float. This is the authorized ceiling —
		// capture at settlement can be <= this value, never more (per your
		// authorize-then-capture rule).
		priceAuthorized: numeric('price_authorized', { precision: 10, scale: 2 }).notNull(),
		priceCaptured: numeric('price_captured', { precision: 10, scale: 2 }), // null until settled

		joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
		cancelledAt: timestamp('cancelled_at', { withTimezone: true })
	},
	(t) => [
		{ uniqueUserPerSession: uniqueIndex('session_participant_unique').on(t.sessionId, t.userId) },
		{ sessionIdx: index('session_participants_session_idx').on(t.sessionId) }
	]
);

// ─────────────────────────────────────────────────────────────
// PAYMENTS (Stripe references — authorize-then-capture flow)
// ─────────────────────────────────────────────────────────────

export const payments = pgTable(
	'payments',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		sessionParticipantId: uuid('session_participant_id')
			.notNull()
			.unique()
			.references(() => sessionParticipants.id, { onDelete: 'restrict' }),

		stripePaymentIntentId: text('stripe_payment_intent_id').notNull().unique(),

		amountAuthorized: numeric('amount_authorized', { precision: 10, scale: 2 }).notNull(),
		amountCaptured: numeric('amount_captured', { precision: 10, scale: 2 }),

		status: paymentStatusEnum('status').notNull().default('authorized'),

		authorizedAt: timestamp('authorized_at', { withTimezone: true }).notNull().defaultNow(),
		capturedAt: timestamp('captured_at', { withTimezone: true }),
		failureReason: text('failure_reason'), // populated on capture_failed — surfaced to admin

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [{ statusIdx: index('payments_status_idx').on(t.status) }]
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
	amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
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
