// Tutor search: pure filtering and ranking over candidates the repository has already narrowed
// to "active tutors who teach at least one of these chapters". Kept free of DB code so the
// behaviour is tested here, and the query can move into Postgres later without changing it.

import {
	intersectWindows,
	normaliseWindows,
	shiftWindows,
	timeZoneOffsetMinutes,
	type WeeklyWindow
} from './availability';
import { isWithinRadius, distanceKm, type LatLng } from './geo';
import { TIME_SLOTS, type SearchMode } from '$lib/constants/search';

export type TeachingMode = 'online' | 'in_person' | 'both';

export interface SearchCriteria {
	/** Chapters the searcher wants: a course's chapters, or a subset they picked. */
	topicIds: readonly string[];
	/** Times the searcher wants, in their timezone. Null = no time filter. */
	windows: readonly WeeklyWindow[] | null;
	timeZone: string;
	mode: SearchMode;
	/** The searcher's postcode centroid, if they gave one. */
	location: LatLng | null;
	/** A tutor must share at least one continuous window this long. */
	minSharedMinutes: number;
}

export interface SearchCandidate {
	id: string;
	teachingMode: TeachingMode;
	timeZone: string;
	availability: readonly WeeklyWindow[];
	/** Chapters this tutor teaches (only need to include ones relevant to the search). */
	coveredTopicIds: readonly string[];
	location: LatLng | null;
	travelRadiusKm: number | null;
	/** Upcoming open groups on the searched chapters. */
	openGroupCount: number;
	/** Cheapest hourly price per student (a full group), or null if no rate yet. */
	fromPriceCents: number | null;
}

export interface SearchResult<T extends SearchCandidate> {
	tutor: T;
	coveredCount: number;
	/** The tutor's weekly hours in the searcher's timezone. */
	hours: WeeklyWindow[];
	/** Shared windows at least `minSharedMinutes` long; empty when there's no time filter. */
	sharedTimes: WeeklyWindow[];
	sharedMinutes: number;
	/** Km from the searcher's postcode to the tutor's, when both are known. */
	distanceKm: number | null;
}

/** "2-after" → Tuesday 3–6pm. Unknown codes are ignored. Adjacent slots are merged. */
export function slotCodesToWindows(codes: readonly string[]): WeeklyWindow[] {
	const raw: WeeklyWindow[] = [];
	for (const code of codes) {
		const [dayPart, key] = code.split('-');
		const day = Number(dayPart);
		const slot = TIME_SLOTS.find((s) => s.key === key);
		if (!slot || !Number.isInteger(day) || day < 1 || day > 7) continue;
		raw.push({ day, start: slot.start, end: slot.end });
	}
	const result = normaliseWindows(raw, { min: 0, max: 24 * 60, step: 1 });
	return result.ok ? result.windows : [];
}

/** Can this tutor teach in the requested format, and (for in person) reach the searcher? */
export function formatFits(
	mode: SearchMode,
	tutor: Pick<SearchCandidate, 'teachingMode' | 'location' | 'travelRadiusKm'>,
	searcher: LatLng | null
): boolean {
	const online = tutor.teachingMode !== 'in_person';
	const inPerson = tutor.teachingMode !== 'online';
	const reaches =
		searcher === null ||
		(tutor.location !== null &&
			tutor.travelRadiusKm !== null &&
			isWithinRadius(tutor.location, searcher, tutor.travelRadiusKm));

	if (mode === 'online') return online;
	if (mode === 'in_person') return inPerson && reaches;
	return online || (inPerson && reaches);
}

/**
 * Filters and ranks candidates. Order: most of the wanted chapters covered, then most shared
 * time, then most open groups to join (the price-drop hook), then cheapest.
 * Tutor hours are shifted into the searcher's timezone using offsets at `now`.
 */
export function searchTutors<T extends SearchCandidate>(
	criteria: SearchCriteria,
	candidates: readonly T[],
	now: Date = new Date()
): SearchResult<T>[] {
	const wanted = new Set(criteria.topicIds);
	const searcherOffset = timeZoneOffsetMinutes(criteria.timeZone, now);
	const results: SearchResult<T>[] = [];

	for (const tutor of candidates) {
		const coveredCount = tutor.coveredTopicIds.filter((id) => wanted.has(id)).length;
		if (coveredCount === 0) continue;
		if (!formatFits(criteria.mode, tutor, criteria.location)) continue;

		const hours = shiftWindows(
			tutor.availability,
			searcherOffset - timeZoneOffsetMinutes(tutor.timeZone, now)
		);

		let sharedTimes: WeeklyWindow[] = [];
		if (criteria.windows) {
			sharedTimes = intersectWindows(criteria.windows, hours).filter(
				(w) => w.end - w.start >= criteria.minSharedMinutes
			);
			if (sharedTimes.length === 0) continue;
		}

		results.push({
			tutor,
			coveredCount,
			hours,
			sharedTimes,
			sharedMinutes: sharedTimes.reduce((sum, w) => sum + (w.end - w.start), 0),
			distanceKm:
				criteria.location && tutor.location ? distanceKm(criteria.location, tutor.location) : null
		});
	}

	return results.sort(
		(a, b) =>
			b.coveredCount - a.coveredCount ||
			b.sharedMinutes - a.sharedMinutes ||
			b.tutor.openGroupCount - a.tutor.openGroupCount ||
			comparePrice(a.tutor.fromPriceCents, b.tutor.fromPriceCents) ||
			a.tutor.id.localeCompare(b.tutor.id)
	);
}

/** Cheapest first; tutors without a rate last. */
function comparePrice(a: number | null, b: number | null): number {
	if (a === b) return 0;
	if (a === null) return 1;
	if (b === null) return -1;
	return a - b;
}

export interface Page<T> {
	items: T[];
	page: number;
	pageCount: number;
	total: number;
}

/** 1-based paging. A page past the end clamps to the last page. */
export function paginate<T>(items: readonly T[], page: number, pageSize: number): Page<T> {
	const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
	const current = Math.min(Math.max(1, Math.floor(page)), pageCount);
	const start = (current - 1) * pageSize;
	return {
		items: items.slice(start, start + pageSize),
		page: current,
		pageCount,
		total: items.length
	};
}

export interface CourseChapters {
	key: string;
	topicIds: readonly string[];
}

export interface CourseCoverage {
	key: string;
	covered: number;
	total: number;
}

/**
 * Which of `courses` a tutor teaches, and how much of each: only courses where they cover at
 * least one chapter. Most complete first (by share, then by chapters covered), then input order.
 */
export function courseCoverage(
	coveredTopicIds: readonly string[],
	courses: readonly CourseChapters[]
): CourseCoverage[] {
	const covered = new Set(coveredTopicIds);
	return courses
		.map((c, index) => ({
			key: c.key,
			covered: c.topicIds.filter((id) => covered.has(id)).length,
			total: c.topicIds.length,
			index
		}))
		.filter((c) => c.covered > 0)
		.sort(
			(a, b) =>
				b.covered / b.total - a.covered / a.total || b.covered - a.covered || a.index - b.index
		)
		.map(({ key, covered, total }) => ({ key, covered, total }));
}
