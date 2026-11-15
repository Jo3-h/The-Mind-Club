import { and, eq, gt, inArray, sql, type SQL } from 'drizzle-orm';
import { db, type Executor } from '../db';
import { user } from '../db/auth-schema';
import { bookings } from '../db/schema/bookings';
import { courses } from '../db/schema/courses';
import { subjects } from '../db/schema/subjects';
import { topics } from '../db/schema/topics';
import { tutoringSessions } from '../db/schema/tutoring-sessions';

export type OpenSessionRow = Awaited<ReturnType<typeof OpenSessions.list>>[number];

export const OpenSessions = {
	/**
	 * Upcoming scheduled sessions other students can join (visibility 'open'), with seat counts.
	 * Filter by topics, by tutor, or both. Lock time and capacity are checked by the caller
	 * (domain/matching.filterJoinableSessions), not here.
	 */
	async list(params: { after: Date; topicIds?: string[]; tutorIds?: string[]; tx?: Executor }) {
		const { after, topicIds, tutorIds, tx = db } = params;
		if (topicIds?.length === 0 || tutorIds?.length === 0) return [];

		const filters: SQL[] = [
			eq(tutoringSessions.status, 'scheduled'),
			eq(tutoringSessions.visibility, 'open'),
			gt(tutoringSessions.startsAt, after)
		];
		if (topicIds) filters.push(inArray(tutoringSessions.topicId, topicIds));
		if (tutorIds) filters.push(inArray(tutoringSessions.tutorId, tutorIds));

		const rows = await tx
			.select({
				id: tutoringSessions.id,
				tutorId: tutoringSessions.tutorId,
				tutorName: user.name,
				topicId: tutoringSessions.topicId,
				topicTitle: topics.title,
				subjectName: subjects.name,
				courseName: courses.name,
				courseYearLevel: courses.yearLevel,
				startsAt: tutoringSessions.startsAt,
				endsAt: tutoringSessions.endsAt,
				capacity: tutoringSessions.capacity,
				locationType: tutoringSessions.locationType,
				suburb: tutoringSessions.suburb,
				baseRateCents: tutoringSessions.baseRateCents,
				pricingSchemeId: tutoringSessions.pricingSchemeId,
				// seats held = confirmed + pending that hasn't expired (see bookings.ts)
				seatsTaken: sql<number>`cast(count(${bookings.id}) filter (where ${bookings.status} = 'confirmed' or (${bookings.status} = 'pending' and (${bookings.expiresAt} is null or ${bookings.expiresAt} > now()))) as int)`,
				// group size for pricing = confirmed (attended/no_show only exist after the session)
				confirmed: sql<number>`cast(count(${bookings.id}) filter (where ${bookings.status} = 'confirmed') as int)`
			})
			.from(tutoringSessions)
			.innerJoin(topics, eq(topics.id, tutoringSessions.topicId))
			.innerJoin(subjects, eq(subjects.id, topics.subjectId))
			.innerJoin(user, eq(user.id, tutoringSessions.tutorId))
			.leftJoin(courses, eq(courses.id, tutoringSessions.courseId))
			.leftJoin(bookings, eq(bookings.sessionId, tutoringSessions.id))
			.where(and(...filters))
			.groupBy(tutoringSessions.id, topics.id, subjects.id, user.id, courses.id)
			.orderBy(tutoringSessions.startsAt);

		return rows.map((r) => ({
			...r,
			durationMinutes: Math.round((r.endsAt.getTime() - r.startsAt.getTime()) / 60000)
		}));
	}
};
