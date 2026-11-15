import { db, type Executor } from '../db';
import { filterJoinableSessions, rankTutors, type StudentMatchContext } from '../domain/matching';
import { lowestHourlyPricePerStudent, sessionPrices } from '../domain/tierPricing';
import type {
	OpenSessionMatch,
	Recommendations as RecommendationsResult,
	TutorMatch
} from '$lib/types/onboarding';
import { OpenSessions } from './open-sessions';
import { Pricing } from './pricing';
import { TutorDirectory } from './tutor-directory';

const MAX_TUTORS = 12;
const MAX_SESSIONS = 10;

export const Recommendations = {
	/**
	 * Read-only suggestions for a student: tutors who teach their topics at times they share,
	 * and open groups they could join. Not a matching engine; see domain/matching.ts.
	 */
	async forStudent(params: {
		studentId: string;
		student: StudentMatchContext;
		topicTitles: Map<string, string>;
		now?: Date;
		tx?: Executor;
	}): Promise<RecommendationsResult> {
		const { studentId, student, topicTitles, now = new Date(), tx = db } = params;
		const topicIds = [...student.topicIds];
		if (topicIds.length === 0) return { openSessions: [], tutors: [] };

		const [candidates, sessions] = await Promise.all([
			TutorDirectory.candidates({ topicIds, excludeUserId: studentId, tx }),
			OpenSessions.list({ topicIds, after: now, tx })
		]);
		const pricing = await Pricing.sheetsWithCurrent({
			at: now,
			schemeIds: sessions.map((s) => s.pricingSchemeId),
			tx
		});

		// ---- open sessions ----
		const joinable = filterJoinableSessions(student, sessions, now).slice(0, MAX_SESSIONS);
		const openSessionMatches: OpenSessionMatch[] = [];
		for (const s of joinable) {
			// each session keeps its own scheme; prices are what a student pays (fee included)
			const prices = sessionPrices({
				sheet: pricing.sheetFor(s.pricingSchemeId),
				baseRateCents: s.baseRateCents,
				durationMinutes: s.durationMinutes,
				groupSize: s.confirmed,
				capacity: s.capacity
			});
			if (!prices || prices.ifOneMoreCents === null) continue; // no tiers seeded, or full
			openSessionMatches.push({
				id: s.id,
				tutorName: s.tutorName,
				topicTitle: s.topicTitle,
				subjectLabel: s.courseName ? `Year ${s.courseYearLevel} ${s.courseName}` : s.subjectName,
				startsAt: s.startsAt.toISOString(),
				durationMinutes: s.durationMinutes,
				joined: s.seatsTaken,
				capacity: s.capacity,
				locationType: s.locationType === 'online' ? 'online' : 'in_person',
				suburb: s.suburb,
				pricePerStudent: prices.nowCents,
				priceIfYouJoin: prices.ifOneMoreCents
			});
		}

		// ---- tutors ----
		const openCountByTutor = new Map<string, number>();
		for (const s of sessions)
			openCountByTutor.set(s.tutorId, (openCountByTutor.get(s.tutorId) ?? 0) + 1);

		const wanted = new Set(topicIds);
		const tutors: TutorMatch[] = rankTutors(student, candidates, now)
			.slice(0, MAX_TUTORS)
			.map(({ tutor, overlaps }) => ({
				id: tutor.id,
				name: tutor.name,
				headline: tutor.headline ?? '',
				avatarUrl: tutor.image,
				coveredTopics: tutor.coveredTopicIds
					.filter((id) => wanted.has(id))
					.map((id) => topicTitles.get(id) ?? 'Topic'),
				totalTopics: topicIds.length,
				overlaps,
				teachingMode: tutor.teachingMode,
				maxGroupSize: tutor.maxGroupSize,
				openSessionCount: openCountByTutor.get(tutor.id) ?? 0,
				// cheapest an hour gets (fee included): a full group at the tutor's limit
				fromPricePerStudent: pricing.current
					? lowestHourlyPricePerStudent({
							sheet: pricing.current,
							baseRateCents: tutor.baseRateCents,
							maxGroupSize: tutor.maxGroupSize
						})
					: null
			}));

		return { openSessions: openSessionMatches, tutors };
	}
};
