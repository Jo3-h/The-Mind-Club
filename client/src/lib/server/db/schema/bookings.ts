import { pgTable, text, uuid, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tstz, timestamps } from './_columns';
import { bookingStatus } from './enums';
import { tutoringSessions } from './tutoring-sessions';
import { studentProfiles } from './student-profiles';
import { user } from '../auth-schema';

/**
 * A student's seat in a session (what we earlier called "participants").
 *
 * Seats taken = bookings where status in ('pending' not yet expired, 'confirmed').
 * Group size for pricing = bookings where status in ('confirmed', 'attended', 'no_show').
 *
 * Joining must lock the session row (SELECT … FOR UPDATE) in the same transaction as
 * counting seats and inserting, or two students can grab the last seat at once.
 */
export const bookings = pgTable(
	'bookings',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		sessionId: uuid('session_id')
			.notNull()
			.references(() => tutoringSessions.id, { onDelete: 'restrict' }),
		/** Who ATTENDS. Who PAYS is on payments.payer_user_id (a parent, one day). */
		studentId: text('student_id')
			.notNull()
			.references(() => studentProfiles.userId, { onDelete: 'restrict' }),
		status: bookingStatus('status').notNull().default('pending'),
		/** Pending seats are released after this (a sweeper job cancels them). */
		expiresAt: tstz('expires_at'),

		/**
		 * The most this student agreed to pay: the per-student price at the group size when
		 * they joined. Their final price is never higher than this, even if others cancel.
		 * Stored as the TUTOR price (before the booking fee); the student is charged
		 * withBookingFee(price) under the session's scheme (domain/feeSplit.ts).
		 */
		priceCapCents: integer('price_cap_cents').notNull(),
		/** Set when the session completes: min(price_cap, price at final group size). Tutor price. */
		finalPriceCents: integer('final_price_cents'),

		confirmedAt: tstz('confirmed_at'),
		cancelledAt: tstz('cancelled_at'),
		cancelledByUserId: text('cancelled_by_user_id').references(() => user.id, {
			onDelete: 'set null'
		}),
		cancelReason: text('cancel_reason'),
		...timestamps()
	},
	(t) => [
		// one live booking per student per session (re-booking after cancelling is allowed)
		uniqueIndex('bookings_one_live_per_student_idx')
			.on(t.sessionId, t.studentId)
			.where(sql`${t.status} <> 'cancelled'`),
		index('bookings_session_idx').on(t.sessionId, t.status),
		index('bookings_student_idx').on(t.studentId, t.status)
	]
);
