import { describe, expect, it } from 'vitest';
import {
	getLowestPricePerStudentCents,
	getPricePerStudentCents,
	PricingTierNotFoundError,
	type PricingTier
} from './pricing';

const tiers: PricingTier[] = [
	{ groupSize: 4, participantCount: 1, pricePerStudentCents: 8000 },
	{ groupSize: 4, participantCount: 2, pricePerStudentCents: 6000 },
	{ groupSize: 4, participantCount: 3, pricePerStudentCents: 5000 },
	{ groupSize: 4, participantCount: 4, pricePerStudentCents: 4000 }
];

describe('getPricePerStudentCents', () => {
	it('returns the price for a matching tier', () => {
		expect(getPricePerStudentCents(tiers, 4, 1)).toBe(8000);
		expect(getPricePerStudentCents(tiers, 4, 3)).toBe(5000);
	});

	it('returns a lower price as participantCount increases', () => {
		const prices = [1, 2, 3, 4].map((n) => getPricePerStudentCents(tiers, 4, n));
		expect(prices).toEqual([8000, 6000, 5000, 4000]);
	});

	it('throws RangeError when participantCount is below 1', () => {
		expect(() => getPricePerStudentCents(tiers, 4, 0)).toThrow(RangeError);
	});

	it('throws RangeError when participantCount exceeds groupSize', () => {
		expect(() => getPricePerStudentCents(tiers, 4, 5)).toThrow(RangeError);
	});

	it('throws PricingTierNotFoundError when no tier is seeded for the combination', () => {
		expect(() => getPricePerStudentCents(tiers, 6, 2)).toThrow(PricingTierNotFoundError);
	});
});

describe('getLowestPricePerStudentCents', () => {
	it('returns the price at a full group (participantCount === groupSize)', () => {
		expect(getLowestPricePerStudentCents(tiers, 4)).toBe(4000);
	});
});
