import { pgTable, text, uuid, smallint, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tstz } from './_columns';
import { user } from '../auth-schema';

/**
 * Recurring weekly windows, for BOTH tutors (when they can be booked) and students
 * (when they're free — used for matching). One table, keyed by user.
 *
 * Stored as LOCAL wall-clock minutes + the profile's IANA timezone, NOT as UTC.
 * "Tuesdays 4–6pm" must stay 4–6pm across daylight saving; a UTC value would drift by an hour.
 * Convert to real instants only when generating concrete times (with a tz-aware library).
 *
 * Booked time is never written here. Free time =
 *   weekly windows − availability_exceptions(blocked) + availability_exceptions(extra)
 *   − the tutor's scheduled tutoring_sessions
 *
 * Saving: replace the user's whole set in one transaction (delete + insert). Overlaps are
 * prevented by the UI/validation, not the DB.
 */
export const weeklyAvailability = pgTable(
	'weekly_availability',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		/** ISO weekday: 1 = Monday … 7 = Sunday. */
		weekday: smallint('weekday').notNull(),
		/** Minutes from local midnight. End is exclusive. 960 = 4:00pm. */
		startMinute: smallint('start_minute').notNull(),
		endMinute: smallint('end_minute').notNull(),
		createdAt: tstz('created_at').notNull().defaultNow()
	},
	(t) => [
		index('weekly_availability_user_idx').on(t.userId, t.weekday),
		check('wa_weekday_chk', sql`${t.weekday} between 1 and 7`),
		check(
			'wa_range_chk',
			sql`${t.startMinute} >= 0 and ${t.endMinute} <= 1440 and ${t.endMinute} > ${t.startMinute}`
		)
	]
);
