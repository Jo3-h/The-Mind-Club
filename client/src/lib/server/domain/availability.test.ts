import { describe, expect, it } from 'vitest';
import {
	intersectWindows,
	isValidTimeZone,
	isWithinWindows,
	localWeekdayMinute,
	normaliseWindows,
	shiftWindows,
	timeZoneOffsetMinutes,
	totalWindowMinutes
} from './availability';

const RULES = { min: 420, max: 1320, step: 30 };

describe('normaliseWindows', () => {
	it('sorts and merges overlapping and touching windows on the same day', () => {
		const result = normaliseWindows(
			[
				{ day: 2, start: 960, end: 1020 },
				{ day: 1, start: 600, end: 660 },
				{ day: 2, start: 1020, end: 1080 },
				{ day: 2, start: 990, end: 1050 }
			],
			RULES
		);
		expect(result).toEqual({
			ok: true,
			windows: [
				{ day: 1, start: 600, end: 660 },
				{ day: 2, start: 960, end: 1080 }
			]
		});
	});

	it('keeps windows on different days apart', () => {
		const result = normaliseWindows(
			[
				{ day: 1, start: 600, end: 660 },
				{ day: 2, start: 600, end: 660 }
			],
			RULES
		);
		expect(result.ok && result.windows).toHaveLength(2);
	});

	it.each([
		[{ day: 0, start: 600, end: 660 }, 'invalid day'],
		[{ day: 8, start: 600, end: 660 }, 'invalid day'],
		[{ day: 1, start: 390, end: 660 }, 'outside'],
		[{ day: 1, start: 600, end: 1350 }, 'outside'],
		[{ day: 1, start: 660, end: 660 }, 'end after'],
		[{ day: 1, start: 610, end: 660 }, '30-minute'],
		[{ day: 1.5, start: 600, end: 660 }, 'whole minutes']
	])('rejects %o', (window, message) => {
		const result = normaliseWindows([window], RULES);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain(message);
	});

	it('accepts an empty list (callers decide whether that is allowed)', () => {
		expect(normaliseWindows([], RULES)).toEqual({ ok: true, windows: [] });
	});
});

describe('intersectWindows', () => {
	it('returns only the shared time on matching days', () => {
		expect(
			intersectWindows(
				[
					{ day: 1, start: 900, end: 1080 },
					{ day: 3, start: 600, end: 700 }
				],
				[
					{ day: 1, start: 960, end: 1200 },
					{ day: 2, start: 900, end: 1080 }
				]
			)
		).toEqual([{ day: 1, start: 960, end: 1080 }]);
	});

	it('ignores windows that only touch', () => {
		expect(
			intersectWindows([{ day: 1, start: 600, end: 660 }], [{ day: 1, start: 660, end: 720 }])
		).toEqual([]);
	});
});

describe('shiftWindows', () => {
	it('moves windows within a day', () => {
		expect(shiftWindows([{ day: 2, start: 960, end: 1080 }], -30)).toEqual([
			{ day: 2, start: 930, end: 1050 }
		]);
	});

	it('splits a window that crosses midnight', () => {
		expect(shiftWindows([{ day: 1, start: 1380, end: 1440 }], 30)).toEqual([
			{ day: 1, start: 1410, end: 1440 },
			{ day: 2, start: 0, end: 30 }
		]);
	});

	it('wraps Sunday night into Monday and Monday morning back into Sunday', () => {
		expect(shiftWindows([{ day: 7, start: 1410, end: 1440 }], 60)).toEqual([
			{ day: 1, start: 30, end: 60 }
		]);
		expect(shiftWindows([{ day: 1, start: 0, end: 60 }], -60)).toEqual([
			{ day: 7, start: 1380, end: 1440 }
		]);
	});
});

describe('isWithinWindows', () => {
	const windows = [{ day: 2, start: 960, end: 1080 }];
	it('is true when the whole session fits', () => {
		expect(isWithinWindows(windows, 2, 960, 60)).toBe(true);
		expect(isWithinWindows(windows, 2, 1020, 60)).toBe(true);
	});
	it('is false when it runs past the window or is on another day', () => {
		expect(isWithinWindows(windows, 2, 1050, 60)).toBe(false);
		expect(isWithinWindows(windows, 3, 960, 60)).toBe(false);
	});
});

describe('totalWindowMinutes', () => {
	it('sums window lengths', () => {
		expect(
			totalWindowMinutes([
				{ day: 1, start: 600, end: 660 },
				{ day: 2, start: 900, end: 1020 }
			])
		).toBe(180);
	});
});

describe('timezones', () => {
	// 2026-01-15 is Australian summer (daylight saving in SA/NSW, not in QLD).
	const summer = new Date('2026-01-15T06:00:00Z');
	const winter = new Date('2026-07-15T06:00:00Z');

	it('reports UTC offsets including daylight saving', () => {
		expect(timeZoneOffsetMinutes('Australia/Adelaide', summer)).toBe(630);
		expect(timeZoneOffsetMinutes('Australia/Adelaide', winter)).toBe(570);
		expect(timeZoneOffsetMinutes('Australia/Brisbane', summer)).toBe(600);
		expect(timeZoneOffsetMinutes('UTC', summer)).toBe(0);
	});

	it('gives the local weekday and minute of an instant', () => {
		// 06:00Z Thu 15 Jan = 16:30 Thu in Adelaide (UTC+10:30)
		expect(localWeekdayMinute(summer, 'Australia/Adelaide')).toEqual({ day: 4, minute: 990 });
		// 20:00Z Sun = 06:30 Mon in Adelaide
		expect(localWeekdayMinute(new Date('2026-01-18T20:00:00Z'), 'Australia/Adelaide')).toEqual({
			day: 1,
			minute: 390
		});
	});

	it('validates IANA zone names', () => {
		expect(isValidTimeZone('Australia/Adelaide')).toBe(true);
		expect(isValidTimeZone('Not/AZone')).toBe(false);
	});
});
