import { and, asc, desc, eq, gt, inArray, lt, ne } from 'drizzle-orm';
import { db, type Executor } from '../db';
import { user } from '../db/auth-schema';
import { bookings } from '../db/schema/bookings';
import { courses } from '../db/schema/courses';
import { subjects } from '../db/schema/subjects';
import { topics } from '../db/schema/topics';
import { tutoringSessions } from '../db/schema/tutoring-sessions';

export type BookingRow = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;

export const Booking = {
	async insert(params: { values: NewBooking; tx?: Executor }): Promise<BookingRow> {
		const { values, tx = db } = params;
		const [row] = await tx.insert(bookings).values(values).returning();
		return row;
	},

	/**
	 * Every booking on a session (all statuses) with the student's name. Names are for the tutor
	 * only; student-facing views should use counts.
	 */
	async listForSession(params: { sessionId: string; tx?: Executor }) {
		const { sessionId, tx = db } = params;
		return tx
			.select({
				id: bookings.id,
				studentId: bookings.studentId,
				studentName: user.name,
				status: bookings.status,
				expiresAt: bookings.expiresAt,
				priceCapCents: bookings.priceCapCents,
				finalPriceCents: bookings.finalPriceCents,
				createdAt: bookings.createdAt
			})
			.from(bookings)
			.innerJoin(user, eq(user.id, bookings.studentId))
			.where(eq(bookings.sessionId, sessionId))
			.orderBy(asc(bookings.createdAt));
	},

	/** Bookings for many sessions at once, keyed by session id (for the tutor's list). */
	async listForSessions(params: { sessionIds: string[]; tx?: Executor }) {
		const { sessionIds, tx = db } = params;
		const out = new Map<string, Awaited<ReturnType<typeof Booking.listForSession>>>();
		if (sessionIds.length === 0) return out;
		const rows = await tx
			.select({
				sessionId: bookings.sessionId,
				id: bookings.id,
				studentId: bookings.studentId,
				studentName: user.name,
				status: bookings.status,
				expiresAt: bookings.expiresAt,
				priceCapCents: bookings.priceCapCents,
				finalPriceCents: bookings.finalPriceCents,
				createdAt: bookings.createdAt
			})
			.from(bookings)
			.innerJoin(user, eq(user.id, bookings.studentId))
			.where(inArray(bookings.sessionId, sessionIds))
			.orderBy(asc(bookings.createdAt));
		for (const { sessionId, ...b } of rows) out.set(sessionId, [...(out.get(sessionId) ?? []), b]);
		return out;
	},

	/** A student's booking on a session that isn't cancelled, if any. */
	async findLive(params: { sessionId: string; studentId: string; tx?: Executor }) {
		const { sessionId, studentId, tx = db } = params;
		const [row] = await tx
			.select()
			.from(bookings)
			.where(
				and(
					eq(bookings.sessionId, sessionId),
					eq(bookings.studentId, studentId),
					ne(bookings.status, 'cancelled')
				)
			)
			.limit(1);
		return row;
	},

	async cancel(params: { id: string; byUserId: string; reason: string; tx?: Executor }) {
		const { id, byUserId, reason, tx = db } = params;
		await tx
			.update(bookings)
			.set({
				status: 'cancelled',
				cancelledAt: new Date(),
				cancelledByUserId: byUserId,
				cancelReason: reason,
				updatedAt: new Date()
			})
			.where(eq(bookings.id, id));
	},

	/**
	 * A student's bookings with the session they're for, upcoming (soonest first) or past (most
	 * recent first). Includes cancelled ones so they can see what happened.
	 */
	async listForStudent(params: {
		studentId: string;
		when: 'upcoming' | 'past';
		now?: Date;
		tx?: Executor;
	}) {
		const { studentId, when, now = new Date(), tx = db } = params;
		const rows = await tx
			.select({
				booking: bookings,
				session: tutoringSessions,
				topicTitle: topics.title,
				subjectName: subjects.name,
				courseName: courses.name,
				courseYearLevel: courses.yearLevel,
				tutorName: user.name
			})
			.from(bookings)
			.innerJoin(tutoringSessions, eq(tutoringSessions.id, bookings.sessionId))
			.innerJoin(topics, eq(topics.id, tutoringSessions.topicId))
			.innerJoin(subjects, eq(subjects.id, topics.subjectId))
			.innerJoin(user, eq(user.id, tutoringSessions.tutorId))
			.leftJoin(courses, eq(courses.id, tutoringSessions.courseId))
			.where(
				and(
					eq(bookings.studentId, studentId),
					when === 'upcoming' ? gt(tutoringSessions.endsAt, now) : lt(tutoringSessions.endsAt, now)
				)
			)
			.orderBy(
				when === 'upcoming' ? asc(tutoringSessions.startsAt) : desc(tutoringSessions.startsAt),
				desc(bookings.createdAt)
			)
			.limit(100);
		return rows.map((r) => ({
			booking: r.booking,
			session: r.session,
			topicTitle: r.topicTitle,
			courseLabel: r.courseName ? `Year ${r.courseYearLevel} ${r.courseName}` : r.subjectName,
			tutorName: r.tutorName
		}));
	}
};
