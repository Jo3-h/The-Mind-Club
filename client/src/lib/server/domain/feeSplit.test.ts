import { describe, expect, it } from 'vitest';
import { splitPaymentCents } from './feeSplit';

describe('splitPaymentCents', () => {
	it('takes a 10% platform fee from the total', () => {
		expect(splitPaymentCents(5000)).toEqual({
			amountCents: 5000,
			platformFeeCents: 500,
			tutorAmountCents: 4500
		});
	});

	it('platformFeeCents + tutorAmountCents always equals amountCents', () => {
		for (const amountCents of [0, 1, 99, 100, 4999, 5000, 123_456]) {
			const { platformFeeCents, tutorAmountCents } = splitPaymentCents(amountCents);
			expect(platformFeeCents + tutorAmountCents).toBe(amountCents);
		}
	});

	it('rounds the fee to the nearest cent', () => {
		// 10% of 4999 = 499.9 -> rounds to 500
		expect(splitPaymentCents(4999)).toEqual({
			amountCents: 4999,
			platformFeeCents: 500,
			tutorAmountCents: 4499
		});
	});

	it('handles zero', () => {
		expect(splitPaymentCents(0)).toEqual({
			amountCents: 0,
			platformFeeCents: 0,
			tutorAmountCents: 0
		});
	});

	it('throws RangeError for negative amounts', () => {
		expect(() => splitPaymentCents(-100)).toThrow(RangeError);
	});

	it('throws RangeError for non-integer amounts', () => {
		expect(() => splitPaymentCents(50.5)).toThrow(RangeError);
	});
});
