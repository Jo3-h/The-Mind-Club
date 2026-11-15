import type { PageServerLoad } from './$types';
import {
	DEFAULT_TIME_ZONE,
	STUDENT_ACCOUNT_TYPE,
	YEAR_LEVELS,
	type AuState
} from '$lib/constants/profile';
import { parseTutorSearchParams } from '$lib/schemas/search/tutors';
import { normaliseWindows, type WeeklyWindow } from '$lib/server/domain/availability';
import { currentSchoolYear, yearLevelFor } from '$lib/server/domain/schoolYear';
import { slotCodesToWindows } from '$lib/server/domain/tutorSearch';
import { Availability } from '$lib/server/repositories/availability';
import { Course } from '$lib/server/repositories/courses';
import { CourseTopic } from '$lib/server/repositories/course-topics';
import { Postcode } from '$lib/server/repositories/postcodes';
import { Student } from '$lib/server/repositories/student';
import { Subject } from '$lib/server/repositories/subjects';
import { TutorSearch } from '$lib/server/repositories/tutor-search';

/**
 * Public tutor search. The URL is the whole search state (see schemas/search/tutors.ts).
 *
 * Subject → (optional state, year) → the matching courses. Tutors for ALL matching courses are
 * shown straight away; picking the course you're enrolled in narrows to that course.
 * Logged-in students get their state, year, timezone and saved free times as defaults;
 * anything in the URL wins ("any" clears a default).
 */
export const load: PageServerLoad = async ({ url, locals }) => {
	const params = parseTutorSearchParams(url.searchParams);

	// ---- defaults from a logged-in student's profile ----
	let profileState: AuState | null = null;
	let profileYear: number | null = null;
	let profileTimeZone: string | null = null;
	let myWindows: WeeklyWindow[] = [];
	if (locals.user?.role === STUDENT_ACCOUNT_TYPE) {
		const profile = await Student.getProfile({ userId: locals.user.id });
		if (profile?.onboardingCompletedAt) {
			profileState = profile.state;
			profileTimeZone = profile.timezone;
			if (profile.graduationYear) {
				const year = yearLevelFor(profile.graduationYear, currentSchoolYear(profile.timezone));
				profileYear = (YEAR_LEVELS as readonly number[]).includes(year) ? year : null;
			}
			myWindows = await Availability.listForUser({ userId: locals.user.id });
		}
	}

	// undefined = not in the URL (fall back to the profile); null = explicitly "any"
	const state = params.state === undefined ? profileState : params.state;
	const year = params.year === undefined ? profileYear : params.year;
	const timeZone = params.tz ?? profileTimeZone ?? DEFAULT_TIME_ZONE;

	// ---- subject → matching courses → (optional) your course ----
	const subjects = await Subject.listOrdered();
	const subject = params.subject ? subjects.find((s) => s.key === params.subject) : undefined;

	const courses = subject
		? await Course.listForSearch({ subjectId: subject.id, yearLevel: year, state })
		: [];
	const selected = courses.find((c) => c.course.key === params.course);
	const searchCourses = selected ? [selected] : courses;

	const chaptersByCourse = await CourseTopic.activeTopicIdsByCourse({
		courseIds: searchCourses.map((c) => c.course.id)
	});
	const courseChapters = searchCourses.map((c) => ({
		key: c.course.key,
		topicIds: chaptersByCourse.get(c.course.id) ?? []
	}));

	// ---- when ----
	const canUseMine = myWindows.length > 0;
	const useMine = params.mine && canUseMine;
	const wanted = [...(useMine ? myWindows : []), ...slotCodesToWindows(params.when)];
	const merged = normaliseWindows(wanted, { min: 0, max: 24 * 60, step: 1 });
	const windows = wanted.length > 0 && merged.ok ? merged.windows : null;

	// ---- where ----
	const place = params.postcode ? await Postcode.locate({ postcode: params.postcode }) : null;

	const results = courseChapters.some((c) => c.topicIds.length > 0)
		? await TutorSearch.find({
				courses: courseChapters,
				windows,
				timeZone,
				mode: params.mode,
				location: place ? { lat: place.lat, lng: place.lng } : null,
				page: params.page
			})
		: null;

	return {
		filters: {
			subject: subject?.key ?? null,
			state,
			year,
			course: selected?.course.key ?? null,
			when: params.when,
			mine: useMine,
			mode: params.mode,
			postcode: params.postcode ?? null,
			tz: params.tz ?? null
		},
		/** Which filters came from the student's profile rather than the URL. */
		prefilled: {
			state: params.state === undefined && profileState !== null,
			year: params.year === undefined && profileYear !== null
		},
		canUseMine,
		timeZone,
		subjects: subjects.map((s) => ({ key: s.key, name: s.name })),
		subjectName: subject?.name ?? null,
		courses: courses.map((c) => ({
			key: c.course.key,
			name: c.course.name,
			state: c.course.state,
			yearLevel: c.course.yearLevel,
			textbook: c.course.textbook,
			topicCount: c.topicCount
		})),
		postcode: params.postcode
			? { value: params.postcode, suburb: place?.suburb ?? null, known: !!place }
			: null,
		results
	};
};
