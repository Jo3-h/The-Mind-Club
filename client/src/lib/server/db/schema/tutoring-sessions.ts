import { pgTable, char, text, uuid, smallint, integer, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tstz, timestamps } from './_columns';
import { locationType, sessionStatus, sessionVisibility } from './enums';
import { tutorProfiles } from './tutor-profiles';
import { topics } from './topics';
import { courses } from './courses';
import { sessionSeries } from './session-series';
import { pricingSchemes } from './pricing-schemes';
import { user } from '../auth-schema';

/**
 * One concrete lesson at one time. Named tutoring_sessions because Better Auth already owns `session`.
 *
 * A session is the CONTAINER; the students in it are rows in `bookings`. Never store students,
 * seat counts or prices-paid on this row; derive them from bookings so they can't drift.
 *
 * Created by the first student's booking (or by a tutor publishing a slot, later). The creator picks
 * capacity ≤ the tutor's max_group_size at that moment.
 *
 * Double-booking a tutor is blocked by an EXCLUSION constraint added in a custom migration
 * (drizzle/0001_tutoring_sessions_no_overlap.sql), since Drizzle can't express it.
 */
export const tutoringSessions = pgTable(
	'tutoring_sessions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		tutorId: text('tutor_id')
			.notNull()
			.references(() => tutorProfiles.userId, { onDelete: 'restrict' }),
		seriesId: uuid('series_id').references(() => sessionSeries.id, { onDelete: 'set null' }),

		/** What's being taught — the joinability key. One topic per session. */
		topicId: uuid('topic_id')
			.notNull()
			.references(() => topics.id, { onDelete: 'restrict' }),
		/** The course it was created from, for display ("Year 11 Methods"). Matching ignores it. */
		courseId: uuid('course_id').references(() => courses.id, { onDelete: 'set null' }),

		// ---- when (real instants) ----
		startsAt: tstz('starts_at').notNull(),
		endsAt: tstz('ends_at').notNull(),

		// ---- where ----
		locationType: locationType('location_type').notNull(),
		suburb: text('suburb'),
		postcode: char('postcode', { length: 4 }),
		/** Full address / meeting link: revealed only to booked students. */
		addressLine: text('address_line'),
		meetingUrl: text('meeting_url'),

		// ---- group ----
		capacity: smallint('capacity').notNull(),
		visibility: sessionVisibility('visibility').notNull().default('open'),

		// ---- price snapshot (never recompute from the tutor's current rate) ----
		baseRateCents: integer('base_rate_cents').notNull(),
		pricingSchemeId: uuid('pricing_scheme_id')
			.notNull()
			.references(() => pricingSchemes.id, { onDelete: 'restrict' }),

		status: sessionStatus('status').notNull().default('scheduled'),
		createdByUserId: text('created_by_user_id').references(() => user.id, { onDelete: 'set null' }),
		completedAt: tstz('completed_at'),
		cancelledAt: tstz('cancelled_at'),
		cancelReason: text('cancel_reason'),
		...timestamps()
	},
	(t) => [
		index('ts_tutor_time_idx').on(t.tutorId, t.startsAt),
		// "open groups on topic X coming up" — the hottest matching query
		index('ts_open_topic_time_idx')
			.on(t.topicId, t.startsAt)
			.where(sql`${t.status} = 'scheduled' and ${t.visibility} = 'open'`),
		index('ts_series_idx').on(t.seriesId),
		check('ts_time_chk', sql`${t.endsAt} > ${t.startsAt}`),
		check('ts_capacity_chk', sql`${t.capacity} >= 1`),
		// a session at a student's home is never open to strangers
		check(
			'ts_home_private_chk',
			sql`${t.locationType} <> 'student_home' or ${t.visibility} = 'private'`
		)
	]
);
