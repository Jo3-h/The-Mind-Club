import { and, asc, desc, eq, gt, inArray, lt, sql } from 'drizzle-orm';
import { db, type Executor } from '../db';
import { user } from '../db/auth-schema';
import { bookings } from '../db/schema/bookings';
import { courses } from '../db/schema/courses';
import { subjects } from '../db/schema/subjects';
import { topics } from '../db/schema/topics';
import { tutorProfiles } from '../db/schema/tutor-profiles';
import { tutoringSessions } from '../db/schema/tutoring-sessions';
import type { TimeRange } from '../domain/booking';

export type SessionRow = typeof tutoringSessions.$inferSelect;
export type NewSession = typeof tutoringSessions.$inferInsert;

/** Bookings that hold a seat or mean the student is in the session. */
const LIVE_BOOKING = ['pending', 'confirmed'] as const;

const durationMinutes = (s: { startsAt: Date; endsAt: Date }) =>
	Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 60000);

/** What every session view shows: what, who teaches it, which course it came from. */
const describedFields = {
	session: tutoringSessions,
	topicTitle: topics.title,
	subjectName: subjects.name,
	courseName: courses.name,
	courseYearLevel: courses.yearLevel,
	tutorName: user.name,
	tutorImage: user.image,
	tutorTimeZone: tutorProfiles.timezone
};

function described(tx: Executor) {
	return tx
		.select(describedFields)
		.from(tutoringSessions)
		.innerJoin(topics, eq(topics.id, tutoringSessions.topicId))
		.innerJoin(subjects, eq(subjects.id, topics.subjectId))
		.innerJoin(user, eq(user.id, tutoringSessions.tutorId))
		.innerJoin(tutorProfiles, eq(tutorProfiles.userId, tutoringSessions.tutorId))
		.leftJoin(courses, eq(courses.id, tutoringSessions.courseId));
}

type DescribedRow = Awaited<ReturnType<ReturnType<typeof described>['execute']>>[number];

function shape(r: DescribedRow) {
	return {
		...r.session,
		durationMinutes: durationMinutes(r.session),
		topicTitle: r.topicTitle,
		courseLabel: r.courseName ? `Year ${r.courseYearLevel} ${r.courseName}` : r.subjectName,
		tutor: {
			id: r.session.tutorId,
			name: r.tutorName,
			image: r.tutorImage,
			timeZone: r.tutorTimeZone
		}
	};
}

export type SessionDetail = ReturnType<typeof shape>;

export const Session = {
	/** A session with what/who/where for display, or undefined. Access checks are the caller's. */
	async getDetail(params: { id: string; tx?: Executor }): Promise<SessionDetail | undefined> {
		const { id, tx = db } = params;
		const [row] = await described(tx).where(eq(tutoringSessions.id, id)).limit(1);
		return row ? shape(row) : undefined;
	},

	/**
	 * Locks the session row for the rest of the transaction (SELECT … FOR UPDATE), so seat counts
	 * read after this can't change under us. Must be called inside a transaction.
	 */
	async lockById(params: { id: string; tx: Executor }): Promise<SessionRow | undefined> {
		const { id, tx } = params;
		const [row] = await tx
			.select()
			.from(tutoringSessions)
			.where(eq(tutoringSessions.id, id))
			.for('update');
		return row;
	},

	async insert(params: { values: NewSession; tx?: Executor }): Promise<SessionRow> {
		const { values, tx = db } = params;
		const [row] = await tx.insert(tutoringSessions).values(values).returning();
		return row;
	},

	async cancel(params: { id: string; reason: string; tx?: Executor }) {
		const { id, reason, tx = db } = params;
		await tx
			.update(tutoringSessions)
			.set({
				status: 'cancelled',
				cancelledAt: new Date(),
				cancelReason: reason,
				updatedAt: new Date()
			})
			.where(and(eq(tutoringSessions.id, id), eq(tutoringSessions.status, 'scheduled')));
	},

	/** A tutor's scheduled sessions overlapping [from, to): the time they're already busy. */
	async busyForTutor(params: {
		tutorId: string;
		from: Date;
		to: Date;
		tx?: Executor;
	}): Promise<TimeRange[]> {
		const { tutorId, from, to, tx = db } = params;
		return tx
			.select({ startsAt: tutoringSessions.startsAt, endsAt: tutoringSessions.endsAt })
			.from(tutoringSessions)
			.where(
				and(
					eq(tutoringSessions.tutorId, tutorId),
					eq(tutoringSessions.status, 'scheduled'),
					lt(tutoringSessions.startsAt, to),
					gt(tutoringSessions.endsAt, from)
				)
			);
	},

	/** Scheduled sessions a student holds a live seat in, overlapping [from, to). */
	async busyForStudent(params: {
		studentId: string;
		from: Date;
		to: Date;
		tx?: Executor;
	}): Promise<TimeRange[]> {
		const { studentId, from, to, tx = db } = params;
		return tx
			.select({ startsAt: tutoringSessions.startsAt, endsAt: tutoringSessions.endsAt })
			.from(bookings)
			.innerJoin(tutoringSessions, eq(tutoringSessions.id, bookings.sessionId))
			.where(
				and(
					eq(bookings.studentId, studentId),
					inArray(bookings.status, [...LIVE_BOOKING]),
					eq(tutoringSessions.status, 'scheduled'),
					lt(tutoringSessions.startsAt, to),
					gt(tutoringSessions.endsAt, from)
				)
			);
	},

	/**
	 * A tutor's sessions with their confirmed group size. Upcoming (soonest first) or past
	 * (most recent first). Cancelled sessions are included so the tutor sees what changed.
	 */
	async listForTutor(params: {
		tutorId: string;
		when: 'upcoming' | 'past';
		now?: Date;
		tx?: Executor;
	}) {
		const { tutorId, when, now = new Date(), tx = db } = params;
		const rows = await described(tx)
			.where(
				and(
					eq(tutoringSessions.tutorId, tutorId),
					when === 'upcoming' ? gt(tutoringSessions.endsAt, now) : lt(tutoringSessions.endsAt, now)
				)
			)
			.orderBy(
				when === 'upcoming' ? asc(tutoringSessions.startsAt) : desc(tutoringSessions.startsAt)
			)
			.limit(100);
		return rows.map(shape);
	},

	/** The meeting link for an online session: its own, else the tutor's standing room. */
	async meetingUrl(params: { id: string; tx?: Executor }): Promise<string | null> {
		const { id, tx = db } = params;
		const [row] = await tx
			.select({
				url: sql<
					string | null
				>`coalesce(${tutoringSessions.meetingUrl}, ${tutorProfiles.meetingUrl})`
			})
			.from(tutoringSessions)
			.innerJoin(tutorProfiles, eq(tutorProfiles.userId, tutoringSessions.tutorId))
			.where(eq(tutoringSessions.id, id))
			.limit(1);
		return row?.url ?? null;
	}
};
