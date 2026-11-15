import { db, type Executor } from '../db';
import type { WeeklyWindow } from '../domain/availability';
import type { LatLng } from '../domain/geo';
import { isOpenForJoining } from '../domain/matching';
import { lowestHourlyPricePerStudent } from '../domain/tierPricing';
import { courseCoverage, paginate, searchTutors, type CourseChapters } from '../domain/tutorSearch';
import { MIN_SHARED_MINUTES, SEARCH_PAGE_SIZE, type SearchMode } from '$lib/constants/search';
import { OpenSessions } from './open-sessions';
import { Pricing } from './pricing';
import { TutorDirectory } from './tutor-directory';

export const TutorSearch = {
	/**
	 * Tutors who teach any chapter of `courses`, filtered and ranked (domain/tutorSearch.ts),
	 * one page. Each result says which of those courses the tutor teaches, and how much of each.
	 *
	 * SQL narrows to listed tutors teaching those chapters (indexed on tutor_topics.topic_id);
	 * time, format, distance and ranking run in the tested domain function. At launch scale that
	 * is a few hundred rows at most. If it ever isn't, this is the one function to move into SQL.
	 */
	async find(params: {
		courses: CourseChapters[];
		windows: WeeklyWindow[] | null;
		timeZone: string;
		mode: SearchMode;
		location: LatLng | null;
		page: number;
		now?: Date;
		tx?: Executor;
	}) {
		const { courses, windows, timeZone, mode, location, page, now = new Date(), tx = db } = params;
		const topicIds = [...new Set(courses.flatMap((c) => c.topicIds))];

		const [candidates, sessions, { current: sheet }] = await Promise.all([
			TutorDirectory.candidates({ topicIds, tx }),
			OpenSessions.list({ topicIds, after: now, tx }),
			Pricing.sheetsWithCurrent({ at: now, tx })
		]);

		const openGroups = new Map<string, number>();
		for (const s of sessions) {
			if (isOpenForJoining(s, now)) openGroups.set(s.tutorId, (openGroups.get(s.tutorId) ?? 0) + 1);
		}

		const ranked = searchTutors(
			{ topicIds, windows, timeZone, mode, location, minSharedMinutes: MIN_SHARED_MINUTES },
			candidates.map((c) => ({
				...c,
				openGroupCount: openGroups.get(c.id) ?? 0,
				// fee included: this is what a student would pay
				fromPriceCents: sheet
					? lowestHourlyPricePerStudent({
							sheet,
							baseRateCents: c.baseRateCents,
							maxGroupSize: c.maxGroupSize
						})
					: null
			})),
			now
		);

		const result = paginate(ranked, page, SEARCH_PAGE_SIZE);
		return {
			...result,
			items: result.items.map((r) => ({
				id: r.tutor.id,
				name: r.tutor.name,
				image: r.tutor.image,
				headline: r.tutor.headline,
				teachingMode: r.tutor.teachingMode,
				suburb: r.tutor.suburb,
				maxGroupSize: r.tutor.maxGroupSize,
				bookable: r.tutor.bookable,
				fromPriceCents: r.tutor.fromPriceCents,
				openGroupCount: r.tutor.openGroupCount,
				/** Which of the searched courses they teach, most complete first. */
				courses: courseCoverage(r.tutor.coveredTopicIds, courses),
				hours: r.hours,
				sharedTimes: r.sharedTimes,
				distanceKm: r.distanceKm === null ? null : Math.round(r.distanceKm)
			}))
		};
	}
};

export type TutorSearchResult = Awaited<ReturnType<typeof TutorSearch.find>>;
