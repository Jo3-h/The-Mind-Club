import { describe, expect, it } from 'vitest';
import {
	lowestHourlyPricePerStudent,
	multiplierForGroupSize,
	perStudentPriceCents,
	priceAtGroupSize,
	priceLadder,
	sessionPrices,
	studentPriceAtGroupSize
} from './tierPricing';

const TIERS = [
	{ groupSize: 1, multiplierBps: 10000 },
	{ groupSize: 2, multiplierBps: 7000 },
	{ groupSize: 3, multiplierBps: 5500 },
	{ groupSize: 4, multiplierBps: 4750 }
];
const SHEET = { tiers: TIERS, studentFeeBps: 500 };

describe('multiplierForGroupSize', () => {
	it('uses the exact tier when there is one', () => {
		expect(multiplierForGroupSize(TIERS, 3)).toBe(5500);
	});
	it('uses the largest tier for sizes above it', () => {
		expect(multiplierForGroupSize(TIERS, 6)).toBe(4750);
	});
	it('falls back to the largest tier below a gap', () => {
		expect(
			multiplierForGroupSize(
				[
					{ groupSize: 1, multiplierBps: 10000 },
					{ groupSize: 4, multiplierBps: 5000 }
				],
				3
			)
		).toBe(10000);
	});
	it('returns null when no tier is at or below the size', () => {
		expect(multiplierForGroupSize([{ groupSize: 2, multiplierBps: 7000 }], 1)).toBeNull();
		expect(multiplierForGroupSize([], 2)).toBeNull();
	});
});

describe('perStudentPriceCents', () => {
	it('prices one student for an hour at the base rate', () => {
		expect(
			perStudentPriceCents({ baseRateCents: 8000, durationMinutes: 60, multiplierBps: 10000 })
		).toBe(8000);
	});
	it('scales by duration and multiplier', () => {
		// $80/hr × 1.5h × 70% = $84
		expect(
			perStudentPriceCents({ baseRateCents: 8000, durationMinutes: 90, multiplierBps: 7000 })
		).toBe(8400);
	});
	it('rounds to the nearest cent', () => {
		// 7999 × 45/60 × 0.475 = 2849.64…
		expect(
			perStudentPriceCents({ baseRateCents: 7999, durationMinutes: 45, multiplierBps: 4750 })
		).toBe(2850);
	});
	it('rejects non-integer or out-of-range input', () => {
		expect(() =>
			perStudentPriceCents({ baseRateCents: 80.5, durationMinutes: 60, multiplierBps: 10000 })
		).toThrow(RangeError);
		expect(() =>
			perStudentPriceCents({ baseRateCents: 8000, durationMinutes: 0, multiplierBps: 10000 })
		).toThrow(RangeError);
		expect(() =>
			perStudentPriceCents({ baseRateCents: 8000, durationMinutes: 60, multiplierBps: 0 })
		).toThrow(RangeError);
	});
});

describe('priceAtGroupSize', () => {
	it('drops as the group grows', () => {
		const prices = [1, 2, 3, 4].map((groupSize) =>
			priceAtGroupSize({ tiers: TIERS, baseRateCents: 8000, durationMinutes: 60, groupSize })
		);
		expect(prices).toEqual([8000, 5600, 4400, 3800]);
	});
	it('is null with no applicable tier', () => {
		expect(
			priceAtGroupSize({ tiers: [], baseRateCents: 8000, durationMinutes: 60, groupSize: 2 })
		).toBeNull();
	});
});

describe('studentPriceAtGroupSize', () => {
	it('adds the booking fee to the tutor price', () => {
		// tutor price at 2 = 5600; + 5% = 5880
		expect(
			studentPriceAtGroupSize({
				sheet: SHEET,
				baseRateCents: 8000,
				durationMinutes: 60,
				groupSize: 2
			})
		).toBe(5880);
	});
	it('is null without tiers', () => {
		expect(
			studentPriceAtGroupSize({
				sheet: { tiers: [], studentFeeBps: 500 },
				baseRateCents: 8000,
				durationMinutes: 60,
				groupSize: 2
			})
		).toBeNull();
	});
});

describe('lowestHourlyPricePerStudent', () => {
	it('prices an hour at a full group, fee included', () => {
		// 3800 + 190
		expect(
			lowestHourlyPricePerStudent({ sheet: SHEET, baseRateCents: 8000, maxGroupSize: 4 })
		).toBe(3990);
	});
	it('is null without a rate', () => {
		expect(
			lowestHourlyPricePerStudent({ sheet: SHEET, baseRateCents: null, maxGroupSize: 4 })
		).toBeNull();
	});
});

describe('priceLadder', () => {
	it('lists what each student pays at each group size up to the max', () => {
		expect(
			priceLadder({ sheet: SHEET, baseRateCents: 8000, durationMinutes: 60, maxGroupSize: 3 })
		).toEqual([
			{ groupSize: 1, pricePerStudentCents: 8400 },
			{ groupSize: 2, pricePerStudentCents: 5880 },
			{ groupSize: 3, pricePerStudentCents: 4620 }
		]);
	});
	it('is empty without a rate', () => {
		expect(
			priceLadder({ sheet: SHEET, baseRateCents: null, durationMinutes: 60, maxGroupSize: 3 })
		).toEqual([]);
	});
});

describe('sessionPrices', () => {
	const base = { sheet: SHEET, baseRateCents: 8000, durationMinutes: 60, capacity: 4 };

	it('shows now, one more, and a full group', () => {
		expect(sessionPrices({ ...base, groupSize: 2 })).toEqual({
			nowCents: 5880,
			ifOneMoreCents: 4620,
			lowestCents: 3990
		});
	});
	it('prices an empty or solo session as a group of one', () => {
		expect(sessionPrices({ ...base, groupSize: 0 })?.nowCents).toBe(8400);
		expect(sessionPrices({ ...base, groupSize: 0 })?.ifOneMoreCents).toBe(8400);
	});
	it('has no "one more" price when the session is full', () => {
		expect(sessionPrices({ ...base, groupSize: 4 })?.ifOneMoreCents).toBeNull();
	});
	it('is null without tiers', () => {
		expect(
			sessionPrices({ ...base, sheet: { tiers: [], studentFeeBps: 0 }, groupSize: 1 })
		).toBeNull();
	});
});
