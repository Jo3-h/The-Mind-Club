import { describe, expect, it } from 'vitest';
import { addDays, isoWeekday, localDateParts, zonedTimeToUtc } from './availability';
import {
	availableStarts,
	isStartAvailable,
	locationOptions,
	maxBookableGroupSize,
	overlaps,
	sessionShape,
	travelCheck
} from './booking';

const ADL = 'Australia/Adelaide';
const iso = (d: Date | null) => d?.toISOString() ?? null;

describe('calendar helpers', () => {
	it('adds days across month and year ends', () => {
		expect(addDays({ year: 2026, month: 11, day: 30 }, 1)).toEqual({
			year: 2026,
			month: 12,
			day: 1
		});
		expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({
			year: 2027,
			month: 1,
			day: 1
		});
	});

	it('knows ISO weekdays', () => {
		expect(isoWeekday({ year: 2026, month: 11, day: 14 })).toBe(6); // Saturday
		expect(isoWeekday({ year: 2026, month: 11, day: 15 })).toBe(7); // Sunday
		expect(isoWeekday({ year: 2026, month: 11, day: 16 })).toBe(1); // Monday
	});

	it('reads the local date of an instant', () => {
		// 2026-11-14 14:00Z is 00:30 on the 15th in Adelaide (UTC+10:30 in summer)
		expect(localDateParts(new Date('2026-11-14T14:00:00Z'), ADL)).toEqual({
			year: 2026,
			month: 11,
			day: 15,
			weekday: 7,
			minute: 30
		});
	});
});

describe('zonedTimeToUtc', () => {
	it('converts in summer (ACDT, +10:30) and winter (ACST, +9:30)', () => {
		expect(iso(zonedTimeToUtc({ year: 2026, month: 12, day: 1 }, 16 * 60, ADL))).toBe(
			'2026-12-01T05:30:00.000Z'
		);
		expect(iso(zonedTimeToUtc({ year: 2026, month: 7, day: 1 }, 16 * 60, ADL))).toBe(
			'2026-07-01T06:30:00.000Z'
		);
	});

	it('returns null for a time skipped when clocks go forward', () => {
		// 4 Oct 2026: 2:00am jumps to 3:00am
		expect(zonedTimeToUtc({ year: 2026, month: 10, day: 4 }, 150, ADL)).toBeNull();
		expect(iso(zonedTimeToUtc({ year: 2026, month: 10, day: 4 }, 180, ADL))).toBe(
			'2026-10-03T16:30:00.000Z'
		);
	});

	it('picks the first instant of the hour repeated when clocks go back', () => {
		// 4 Apr 2027: 3:00am goes back to 2:00am; 2:30am happens twice, first at +10:30
		expect(iso(zonedTimeToUtc({ year: 2027, month: 4, day: 4 }, 150, ADL))).toBe(
			'2027-04-03T16:00:00.000Z'
		);
	});
});

describe('availableStarts', () => {
	// Saturday 14 Nov 2026, 10:30am in Adelaide
	const NOW = new Date('2026-11-14T00:00:00Z');
	const tuesday4to6 = [{ day: 2, start: 16 * 60, end: 18 * 60 }];
	const base = { windows: tuesday4to6, timeZone: ADL, busy: [], now: NOW, horizonDays: 7 };

	it('offers each half hour that fits, with the lengths that fit', () => {
		expect(
			availableStarts(base).map((o) => ({ at: o.startsAt.toISOString(), d: o.durations }))
		).toEqual([
			{ at: '2026-11-17T05:30:00.000Z', d: [60, 90, 120] }, // Tue 4:00pm
			{ at: '2026-11-17T06:00:00.000Z', d: [60, 90] }, // 4:30pm
			{ at: '2026-11-17T06:30:00.000Z', d: [60] } // 5:00pm
		]);
	});

	it('works around the tutor’s existing sessions', () => {
		const busy = [
			{ startsAt: new Date('2026-11-17T06:30:00Z'), endsAt: new Date('2026-11-17T07:30:00Z') }
		];
		expect(
			availableStarts({ ...base, busy }).map((o) => ({
				at: o.startsAt.toISOString(),
				d: o.durations
			}))
		).toEqual([{ at: '2026-11-17T05:30:00.000Z', d: [60] }]);
	});

	it('only offers starts that are still open for others to join (D1)', () => {
		// Monday 4:30pm local: Tuesday 4:00pm and 4:30pm are already inside the 24h lock
		const now = new Date('2026-11-16T06:00:00Z');
		expect(availableStarts({ ...base, now }).map((o) => o.startsAt.toISOString())).toEqual([
			'2026-11-17T06:30:00.000Z'
		]);
	});

	it('stops at the booking horizon', () => {
		expect(availableStarts({ ...base, horizonDays: 2 })).toEqual([]);
		expect(availableStarts({ ...base, horizonDays: 28 })).toHaveLength(12); // 4 Tuesdays × 3
	});

	it('skips start times that daylight saving removes', () => {
		// Sunday 1am–4am on 4 Oct 2026, when 2:00am jumps to 3:00am
		const starts = availableStarts({
			windows: [{ day: 7, start: 60, end: 240 }],
			timeZone: ADL,
			busy: [],
			now: new Date('2026-09-30T00:00:00Z'),
			horizonDays: 5,
			durations: [60]
		});
		expect(starts.map((o) => localDateParts(o.startsAt, ADL).minute)).toEqual([60, 90, 180]);
	});

	it('isStartAvailable checks both the start and the length', () => {
		const options = availableStarts(base);
		const at = new Date('2026-11-17T06:00:00Z');
		expect(isStartAvailable(options, at, 90)).toBe(true);
		expect(isStartAvailable(options, at, 120)).toBe(false);
		expect(isStartAvailable(options, new Date('2026-11-17T06:10:00Z'), 60)).toBe(false);
	});
});

describe('overlaps', () => {
	const r = (a: string, b: string) => ({ startsAt: new Date(a), endsAt: new Date(b) });
	it('treats touching ranges as not overlapping', () => {
		expect(
			overlaps(
				r('2026-01-01T01:00Z', '2026-01-01T02:00Z'),
				r('2026-01-01T02:00Z', '2026-01-01T03:00Z')
			)
		).toBe(false);
		expect(
			overlaps(
				r('2026-01-01T01:00Z', '2026-01-01T02:30Z'),
				r('2026-01-01T02:00Z', '2026-01-01T03:00Z')
			)
		).toBe(true);
	});
});

describe('where and how big', () => {
	it('offers locations by teaching mode', () => {
		expect(locationOptions('online')).toEqual(['online']);
		expect(locationOptions('in_person')).toEqual(['tutor_venue', 'public_venue', 'student_home']);
		expect(locationOptions('both')).toEqual([
			'online',
			'tutor_venue',
			'public_venue',
			'student_home'
		]);
	});

	it('checks the tutor’s travel radius', () => {
		const adelaide = { lat: -34.9285, lng: 138.6007 };
		const glenelg = { lat: -34.98, lng: 138.515 }; // ~10km away
		expect(travelCheck({ tutorLocation: adelaide, travelRadiusKm: 15, place: glenelg })).toBe('ok');
		expect(travelCheck({ tutorLocation: adelaide, travelRadiusKm: 5, place: glenelg })).toBe(
			'too_far'
		);
		expect(travelCheck({ tutorLocation: adelaide, travelRadiusKm: 5, place: null })).toBe(
			'unknown'
		);
	});

	it('caps groups at the tutor’s limit and the platform’s', () => {
		expect(maxBookableGroupSize(4)).toBe(4);
		expect(maxBookableGroupSize(8)).toBe(6);
		expect(maxBookableGroupSize(0)).toBe(1);
	});

	it('makes 1:1s and home sessions private (D6)', () => {
		expect(sessionShape({ locationType: 'online', groupSize: 4 })).toEqual({
			capacity: 4,
			visibility: 'open'
		});
		expect(sessionShape({ locationType: 'online', groupSize: 1 })).toEqual({
			capacity: 1,
			visibility: 'private'
		});
		expect(sessionShape({ locationType: 'student_home', groupSize: 4 })).toEqual({
			capacity: 1,
			visibility: 'private'
		});
	});
});
