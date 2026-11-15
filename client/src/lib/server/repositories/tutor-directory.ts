import { and, asc, eq, inArray, isNotNull, ne, type SQL } from 'drizzle-orm';
import { db, type Executor } from '../db';
import { user } from '../db/auth-schema';
import { courseTopics } from '../db/schema/course-topics';
import { courses } from '../db/schema/courses';
import { subjects } from '../db/schema/subjects';
import { topics } from '../db/schema/topics';
import { tutorProfiles } from '../db/schema/tutor-profiles';
import { tutorTopics } from '../db/schema/tutor-topics';
import { BOOKING_REQUIRES_VERIFICATION } from '$lib/constants/sessions';
import { Availability } from './availability';
import { Postcode } from './postcodes';

/**
 * Public, read-only views of tutors for browse, profiles and recommendations.
 * Only ever selects fields that are safe to show anyone: never the exact postcode, WWCC
 * details, Stripe ids or email.
 */

/** Listed = finished onboarding and not paused/suspended. Bookable is shown separately. */
const listed = () => [
	eq(tutorProfiles.status, 'active'),
	isNotNull(tutorProfiles.onboardingCompletedAt)
];

const publicFields = {
	id: tutorProfiles.userId,
	name: user.name,
	image: user.image,
	headline: tutorProfiles.headline,
	bio: tutorProfiles.bio,
	teachingMode: tutorProfiles.teachingMode,
	timezone: tutorProfiles.timezone,
	maxGroupSize: tutorProfiles.maxGroupSize,
	baseRateCents: tutorProfiles.baseRateCents,
	travelRadiusKm: tutorProfiles.travelRadiusKm,
	// internal: turned into a suburb + centroid below, never returned as-is
	postcode: tutorProfiles.postcode,
	stripePayoutsEnabled: tutorProfiles.stripePayoutsEnabled,
	wwccStatus: tutorProfiles.wwccStatus
};

type PublicRow = {
	[K in keyof typeof publicFields]: (typeof publicFields)[K]['_']['data'] | null;
};

/** Shapes a DB row for public use: location becomes suburb + centroid, flags become `bookable`. */
async function toPublic<R extends PublicRow>(rows: R[], tx: Executor) {
	const places = await Postcode.locateMany({
		postcodes: rows.map((r) => r.postcode).filter((p): p is string => !!p),
		tx
	});
	return rows.map(({ postcode, stripePayoutsEnabled, wwccStatus, ...r }) => {
		const place = postcode ? places.get(postcode) : undefined;
		return {
			...r,
			id: r.id as string,
			name: r.name as string,
			teachingMode: r.teachingMode ?? 'online',
			timeZone: r.timezone as string,
			maxGroupSize: r.maxGroupSize as number,
			suburb: place?.suburb ?? null,
			location: place ? { lat: place.lat, lng: place.lng } : null,
			/**
			 * Can take bookings now (bookability rule in tutor-profiles.ts). Needs a rate; the WWCC
			 * and payouts checks only apply once BOOKING_REQUIRES_VERIFICATION is on.
			 */
			bookable:
				r.baseRateCents !== null &&
				(!BOOKING_REQUIRES_VERIFICATION ||
					(stripePayoutsEnabled === true && wwccStatus === 'verified'))
		};
	});
}

export type DirectoryTutor = Awaited<ReturnType<typeof toPublic>>[number];

export const TutorDirectory = {
	/**
	 * Listed tutors who teach any of `topicIds`, with which of those topics each one covers and
	 * their weekly availability. The starting set for search and recommendations.
	 */
	async candidates(params: { topicIds: string[]; excludeUserId?: string; tx?: Executor }) {
		const { topicIds, excludeUserId, tx = db } = params;
		if (topicIds.length === 0) return [];

		const filters: SQL[] = [inArray(tutorTopics.topicId, topicIds), ...listed()];
		if (excludeUserId) filters.push(ne(tutorProfiles.userId, excludeUserId));
		const links = await tx
			.select({ tutorId: tutorTopics.tutorId, topicId: tutorTopics.topicId })
			.from(tutorTopics)
			.innerJoin(tutorProfiles, eq(tutorProfiles.userId, tutorTopics.tutorId))
			.where(and(...filters));

		const covered = new Map<string, string[]>();
		for (const l of links) covered.set(l.tutorId, [...(covered.get(l.tutorId) ?? []), l.topicId]);
		const ids = [...covered.keys()];
		if (ids.length === 0) return [];

		const rows = await tx
			.select(publicFields)
			.from(tutorProfiles)
			.innerJoin(user, eq(user.id, tutorProfiles.userId))
			.where(inArray(tutorProfiles.userId, ids));
		const [tutors, availability] = await Promise.all([
			toPublic(rows, tx),
			Availability.listForUsers({ userIds: ids, tx })
		]);
		return tutors.map((t) => ({
			...t,
			availability: availability.get(t.id) ?? [],
			coveredTopicIds: covered.get(t.id) ?? []
		}));
	},

	/** One listed tutor's public profile, or undefined if they aren't listed. */
	async getProfile(params: { tutorId: string; tx?: Executor }) {
		const { tutorId, tx = db } = params;
		const [row] = await tx
			.select(publicFields)
			.from(tutorProfiles)
			.innerJoin(user, eq(user.id, tutorProfiles.userId))
			.where(and(eq(tutorProfiles.userId, tutorId), ...listed()))
			.limit(1);
		if (!row) return undefined;
		const [tutor] = await toPublic([row], tx);
		const availability = await Availability.listForUser({ userId: tutorId, tx });
		return { ...tutor, availability };
	},

	/**
	 * What a tutor teaches, grouped by the active courses those chapters appear in.
	 * A chapter in several courses is listed under each.
	 */
	async teachingByCourse(params: { tutorId: string; tx?: Executor }) {
		const { tutorId, tx = db } = params;
		const rows = await tx
			.select({
				courseId: courses.id,
				courseKey: courses.key,
				courseName: courses.name,
				yearLevel: courses.yearLevel,
				state: courses.state,
				textbook: courses.textbook,
				subjectName: subjects.name,
				topicId: topics.id,
				title: topics.title,
				chapter: courseTopics.chapterNumber
			})
			.from(tutorTopics)
			.innerJoin(topics, eq(topics.id, tutorTopics.topicId))
			.innerJoin(courseTopics, eq(courseTopics.topicId, topics.id))
			.innerJoin(courses, eq(courses.id, courseTopics.courseId))
			.innerJoin(subjects, eq(subjects.id, courses.subjectId))
			.where(
				and(eq(tutorTopics.tutorId, tutorId), eq(topics.isActive, true), eq(courses.isActive, true))
			)
			.orderBy(
				asc(courses.yearLevel),
				asc(subjects.sortOrder),
				asc(courses.sortOrder),
				asc(courseTopics.chapterNumber)
			);

		const groups = new Map<
			string,
			{
				id: string;
				key: string;
				name: string;
				yearLevel: number;
				state: string | null;
				textbook: string | null;
				subjectName: string;
				chapters: { topicId: string; title: string; chapter: number }[];
			}
		>();
		for (const r of rows) {
			let g = groups.get(r.courseKey);
			if (!g) {
				g = {
					id: r.courseId,
					key: r.courseKey,
					name: r.courseName,
					yearLevel: r.yearLevel,
					state: r.state,
					textbook: r.textbook,
					subjectName: r.subjectName,
					chapters: []
				};
				groups.set(r.courseKey, g);
			}
			g.chapters.push({ topicId: r.topicId, title: r.title, chapter: r.chapter });
		}
		return [...groups.values()];
	}
};
