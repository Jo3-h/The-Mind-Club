import { describe, expect, it } from 'vitest';
import { centsToDollarsInput, dollarsToCents, formatCents } from './money';

describe('dollarsToCents', () => {
	it.each([
		['65', 6500],
		['65.5', 6550],
		['65.05', 6505],
		[' $120.00 ', 12000],
		['0.99', 99]
	])('%s → %i', (input, cents) => {
		expect(dollarsToCents(input)).toBe(cents);
	});

	it.each(['', 'abc', '65.555', '-5', '1e3', '65,50', '.5'])('rejects %j', (input) => {
		expect(dollarsToCents(input)).toBeNull();
	});
});

describe('centsToDollarsInput / formatCents', () => {
	it('drops .00 and pads single-digit cents', () => {
		expect(centsToDollarsInput(6500)).toBe('65');
		expect(centsToDollarsInput(6505)).toBe('65.05');
		expect(formatCents(6550)).toBe('$65.50');
		expect(formatCents(99)).toBe('$0.99');
	});
	it('round-trips', () => {
		for (const cents of [3000, 4550, 19999, 20000]) {
			expect(dollarsToCents(centsToDollarsInput(cents))).toBe(cents);
		}
	});
});
