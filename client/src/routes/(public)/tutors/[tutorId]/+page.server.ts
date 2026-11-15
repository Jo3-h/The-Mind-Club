import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { DEFAULT_TIME_ZONE, STUDENT_ACCOUNT_TYPE } from '$lib/constants/profile';
import { TutorIdSchema, parseTutorSearchParams } from '$lib/schemas/search/tutors';
import { shiftWindows, timeZoneOffsetMinutes } from '$lib/server/domain/availability';
import { isOpenForJoining } from '$lib/server/domain/matching';
import { priceLadder, sessionPrices } from '$lib/server/domain/tierPricing';
import { OpenSessions } from '$lib/server/repositories/open-sessions';
import { Pricing } from '$lib/server/repositories/pricing';
import { Student } from '$lib/server/repositories/student';
import { TutorDirectory } from '$lib/server/repositories/tutor-directory';

const MAX_OPEN_GROUPS = 10;

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const parsedId = TutorIdSchema.safeParse(params.tutorId);
	if (!parsedId.success) error(404, 'Tutor not found');
	const tutorId = parsedId.data;

	const tutor = await TutorDirectory.getProfile({ tutorId });
	if (!tutor) error(404, 'Tutor not found');

	// the search this visitor came from (kept for "Back to results" and to highlight a course)
	const search = parseTutorSearchParams(url.searchParams);

	// show times in the viewer's zone: their profile if they're a student, else the search's
	let viewerTimeZone = search.tz ?? DEFAULT_TIME_ZONE;
	if (locals.user?.role === STUDENT_ACCOUNT_TYPE) {
		const profile = await Student.getProfile({ userId: locals.user.id });
		if (profile?.timezone) viewerTimeZone = profile.timezone;
	}

	const now = new Date();
	const [teaching, sessions] = await Promise.all([
		TutorDirectory.teachingByCourse({ tutorId }),
		OpenSessions.list({ tutorIds: [tutorId], after: now })
	]);
	const openGroups = sessions.filter((s) => isOpenForJoining(s, now)).slice(0, MAX_OPEN_GROUPS);
	const pricing = await Pricing.sheetsWithCurrent({
		at: now,
		schemeIds: openGroups.map((s) => s.pricingSchemeId)
	});

	const delta =
		timeZoneOffsetMinutes(viewerTimeZone, now) - timeZoneOffsetMinutes(tutor.timeZone, now);

	return {
		tutor: {
			id: tutor.id,
			name: tutor.name,
			image: tutor.image,
			headline: tutor.headline,
			bio: tutor.bio,
			teachingMode: tutor.teachingMode,
			suburb: tutor.suburb,
			travelRadiusKm: tutor.travelRadiusKm,
			maxGroupSize: tutor.maxGroupSize,
			bookable: tutor.bookable,
			hasRate: tutor.baseRateCents !== null
		},
		hours: shiftWindows(tutor.availability, delta),
		viewerTimeZone,
		teaching,
		highlightCourse: search.course ?? null,
		// one hour, current pricing: what each student pays (fee included) at every group size
		ladder: pricing.current
			? priceLadder({
					sheet: pricing.current,
					baseRateCents: tutor.baseRateCents,
					durationMinutes: 60,
					maxGroupSize: tutor.maxGroupSize
				})
			: [],
		openGroups: openGroups.flatMap((s) => {
			const prices = sessionPrices({
				sheet: pricing.sheetFor(s.pricingSchemeId),
				baseRateCents: s.baseRateCents,
				durationMinutes: s.durationMinutes,
				groupSize: s.confirmed,
				capacity: s.capacity
			});
			if (!prices || prices.ifOneMoreCents === null) return [];
			return [
				{
					id: s.id,
					topicTitle: s.topicTitle,
					courseLabel: s.courseName ? `Year ${s.courseYearLevel} ${s.courseName}` : s.subjectName,
					startsAt: s.startsAt.toISOString(),
					durationMinutes: s.durationMinutes,
					seatsTaken: s.seatsTaken,
					capacity: s.capacity,
					online: s.locationType === 'online',
					suburb: s.suburb,
					pricePerStudentCents: prices.nowCents,
					priceIfYouJoinCents: prices.ifOneMoreCents
				}
			];
		}),
		backQuery: url.searchParams.toString()
	};
};
