import { pgTable, char, text, uuid, smallint, date, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from './_columns';
import { locationType, seriesStatus, sessionVisibility } from './enums';
import { tutorProfiles } from './tutor-profiles';

/**
 * A recurring slot: "Tuesdays 4:30pm, 60 min, with this tutor, up to 4 students".
 *
 * A series is only a TEMPLATE. Each week is its own real row in tutoring_sessions (with its own
 * topic, bookings and price), generated a few weeks ahead. Nothing ever reads "virtual" sessions,
 * which keeps every query simple. A one-off session just has series_id = NULL.
 */
export const sessionSeries = pgTable(
	'session_series',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		tutorId: text('tutor_id')
			.notNull()
			.references(() => tutorProfiles.userId, { onDelete: 'restrict' }),
		status: seriesStatus('status').notNull().default('active'),

		weekday: smallint('weekday').notNull(), // ISO 1–7
		startMinute: smallint('start_minute').notNull(), // local wall-clock
		durationMinutes: smallint('duration_minutes').notNull(),
		timezone: text('timezone').notNull(),
		startsOn: date('starts_on').notNull(),
		endsOn: date('ends_on'), // NULL = open-ended

		capacity: smallint('capacity').notNull(),
		visibility: sessionVisibility('visibility').notNull().default('open'),
		locationType: locationType('location_type').notNull(),
		suburb: text('suburb'),
		postcode: char('postcode', { length: 4 }),
		...timestamps()
	},
	(t) => [
		index('session_series_tutor_idx').on(t.tutorId),
		check('ss_weekday_chk', sql`${t.weekday} between 1 and 7`),
		check('ss_duration_chk', sql`${t.durationMinutes} > 0`),
		check('ss_capacity_chk', sql`${t.capacity} >= 1`)
	]
);
