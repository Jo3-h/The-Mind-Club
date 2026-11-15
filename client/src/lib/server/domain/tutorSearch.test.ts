import { describe, expect, it } from 'vitest';
import {
	courseCoverage,
	formatFits,
	paginate,
	searchTutors,
	slotCodesToWindows,
	type SearchCandidate,
	type SearchCriteria
} from './tutorSearch';

// Thu 15 Jan 2026, 09:00 Adelaide (daylight saving: Adelaide +10:30, Sydney +11, Brisbane +10)
const NOW = new Date('2026-01-14T22:30:00Z');

const ADELAIDE = { lat: -34.9285, lng: 138.6007 };
const GLENELG = { lat: -34.9806, lng: 138.5155 }; // ~9.6 km from ADELAIDE
const MELBOURNE = { lat: -37.8136, lng: 144.9631 };

const criteria = (overrides: Partial<SearchCriteria> = {}): SearchCriteria => ({
	topicIds: ['t1', 't2', 't3'],
	windows: null,
	timeZone: 'Australia/Adelaide',
	mode: 'either',
	location: null,
	minSharedMinutes: 60,
	...overrides
});

const tutor = (overrides: Partial<SearchCandidate> & { id: string }): SearchCandidate => ({
	teachingMode: 'online',
	timeZone: 'Australia/Adelaide',
	// Tue 3–6pm
	availability: [{ day: 2, start: 900, end: 1080 }],
	coveredTopicIds: ['t1'],
	location: null,
	travelRadiusKm: null,
	openGroupCount: 0,
	fromPriceCents: 4000,
	...overrides
});

describe('slotCodesToWindows', () => {
	it('turns slot codes into windows and merges adjacent ones', () => {
		expect(slotCodesToWindows(['2-after', '2-evening', '6-early'])).toEqual([
			{ day: 2, start: 900, end: 1320 },
			{ day: 6, start: 420, end: 540 }
		]);
	});
	it('ignores unknown codes', () => {
		expect(slotCodesToWindows(['9-after', '2-lunch', 'junk', ''])).toEqual([]);
	});
});

describe('formatFits', () => {
	const inPersonGlenelg = {
		teachingMode: 'in_person' as const,
		location: GLENELG,
		travelRadiusKm: 10
	};
	const onlineOnly = { teachingMode: 'online' as const, location: null, travelRadiusKm: null };
	const both = { teachingMode: 'both' as const, location: MELBOURNE, travelRadiusKm: 5 };

	it('online needs an online-capable tutor', () => {
		expect(formatFits('online', onlineOnly, null)).toBe(true);
		expect(formatFits('online', both, null)).toBe(true);
		expect(formatFits('online', inPersonGlenelg, null)).toBe(false);
	});

	it('in person needs an in-person tutor who travels far enough', () => {
		expect(formatFits('in_person', inPersonGlenelg, ADELAIDE)).toBe(true);
		expect(formatFits('in_person', { ...inPersonGlenelg, travelRadiusKm: 5 }, ADELAIDE)).toBe(
			false
		);
		expect(formatFits('in_person', both, ADELAIDE)).toBe(false); // Melbourne tutor
		expect(formatFits('in_person', onlineOnly, ADELAIDE)).toBe(false);
	});

	it('in person without a searcher postcode accepts any in-person tutor', () => {
		expect(formatFits('in_person', both, null)).toBe(true);
	});

	it('either accepts online tutors anywhere, and in-person-only tutors who reach you', () => {
		expect(formatFits('either', both, ADELAIDE)).toBe(true); // online still works
		expect(formatFits('either', inPersonGlenelg, ADELAIDE)).toBe(true);
		expect(formatFits('either', inPersonGlenelg, MELBOURNE)).toBe(false);
	});
});

describe('searchTutors', () => {
	it('drops tutors who teach none of the chapters or the wrong format', () => {
		const results = searchTutors(
			criteria({ mode: 'online' }),
			[
				tutor({ id: 'ok' }),
				tutor({ id: 'no-chapters', coveredTopicIds: ['other'] }),
				tutor({ id: 'in-person', teachingMode: 'in_person', location: GLENELG, travelRadiusKm: 10 })
			],
			NOW
		);
		expect(results.map((r) => r.tutor.id)).toEqual(['ok']);
		expect(results[0].sharedTimes).toEqual([]); // no time filter
		expect(results[0].hours).toEqual([{ day: 2, start: 900, end: 1080 }]);
	});

	it('with a time filter, needs one shared window of at least the minimum length', () => {
		const tueAfter = [{ day: 2, start: 900, end: 1080 }];
		const results = searchTutors(
			criteria({ windows: tueAfter }),
			[
				tutor({ id: 'full-overlap' }),
				// shares only 30 min (5:30–6pm)
				tutor({ id: 'too-short', availability: [{ day: 2, start: 1050, end: 1200 }] }),
				tutor({ id: 'other-day', availability: [{ day: 3, start: 900, end: 1080 }] })
			],
			NOW
		);
		expect(results.map((r) => r.tutor.id)).toEqual(['full-overlap']);
		expect(results[0].sharedMinutes).toBe(180);
	});

	it("shows a tutor's hours in the searcher's timezone", () => {
		// Brisbane has no daylight saving, so in summer Adelaide (+10:30) is 30 min AHEAD of
		// Brisbane (+10): Brisbane 3:30–6:30pm = Adelaide 4–7pm
		const [result] = searchTutors(
			criteria(),
			[
				tutor({
					id: 'bne',
					timeZone: 'Australia/Brisbane',
					availability: [{ day: 2, start: 930, end: 1110 }]
				})
			],
			NOW
		);
		expect(result.hours).toEqual([{ day: 2, start: 960, end: 1140 }]);
	});

	it('ranks by chapters covered, then shared time, then open groups, then price', () => {
		const windows = [
			{ day: 2, start: 900, end: 1080 },
			{ day: 4, start: 900, end: 1080 }
		];
		const results = searchTutors(
			criteria({ windows }),
			[
				tutor({ id: 'cheap', fromPriceCents: 3000 }),
				tutor({ id: 'no-rate', fromPriceCents: null }),
				tutor({ id: 'pricey', fromPriceCents: 5000 }),
				tutor({ id: 'has-groups', openGroupCount: 2, fromPriceCents: 9000 }),
				tutor({ id: 'more-time', availability: windows }),
				tutor({ id: 'more-chapters', coveredTopicIds: ['t1', 't2'] })
			],
			NOW
		);
		expect(results.map((r) => r.tutor.id)).toEqual([
			'more-chapters',
			'more-time',
			'has-groups',
			'cheap',
			'pricey',
			'no-rate'
		]);
	});

	it('reports distance when both postcodes are known', () => {
		const [result] = searchTutors(
			criteria({ location: ADELAIDE }),
			[tutor({ id: 'g', teachingMode: 'both', location: GLENELG, travelRadiusKm: 15 })],
			NOW
		);
		expect(result.distanceKm).toBeCloseTo(9.6, 0);
	});
});

describe('paginate', () => {
	const items = Array.from({ length: 45 }, (_, i) => i);
	it('slices a 1-based page', () => {
		expect(paginate(items, 2, 20)).toEqual({
			items: items.slice(20, 40),
			page: 2,
			pageCount: 3,
			total: 45
		});
	});
	it('clamps out-of-range pages', () => {
		expect(paginate(items, 99, 20).page).toBe(3);
		expect(paginate(items, 0, 20).page).toBe(1);
		expect(paginate([], 1, 20)).toEqual({ items: [], page: 1, pageCount: 1, total: 0 });
	});
});

describe('courseCoverage', () => {
	const courses = [
		{ key: 'sa-11', topicIds: ['a', 'b', 'c', 'd'] },
		{ key: 'vic-11', topicIds: ['a', 'b'] },
		{ key: 'sa-12', topicIds: ['x', 'y'] }
	];

	it('lists only courses with at least one covered chapter, most complete first', () => {
		expect(courseCoverage(['a', 'b', 'c'], courses)).toEqual([
			{ key: 'vic-11', covered: 2, total: 2 },
			{ key: 'sa-11', covered: 3, total: 4 }
		]);
	});

	it('is empty when nothing overlaps', () => {
		expect(courseCoverage(['zzz'], courses)).toEqual([]);
	});

	it('breaks ties by chapters covered, then course order', () => {
		expect(
			courseCoverage(
				['a', 'x'],
				[
					{ key: 'first', topicIds: ['a', 'b'] },
					{ key: 'second', topicIds: ['x', 'y'] }
				]
			).map((c) => c.key)
		).toEqual(['first', 'second']);
	});
});
