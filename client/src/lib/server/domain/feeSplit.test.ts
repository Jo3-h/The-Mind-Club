import { describe, expect, it } from 'vitest';
import { basisPointsOf, splitCharge, withBookingFee } from './feeSplit';

const RATES = { studentFeeBps: 500, platformFeeBps: 500 };

describe('basisPointsOf', () => {
	it('takes a share in basis points, rounded to the cent', () => {
		expect(basisPointsOf(8000, 500)).toBe(400);
		expect(basisPointsOf(4410, 500)).toBe(221); // 220.5 rounds half up
		expect(basisPointsOf(4390, 500)).toBe(220); // 219.5 rounds half up
		expect(basisPointsOf(0, 500)).toBe(0);
		expect(basisPointsOf(1234, 0)).toBe(0);
	});

	it('rejects non-integer cents and out-of-range rates', () => {
		expect(() => basisPointsOf(10.5, 500)).toThrow(RangeError);
		expect(() => basisPointsOf(-1, 500)).toThrow(RangeError);
		expect(() => basisPointsOf(100, 10_001)).toThrow(RangeError);
		expect(() => basisPointsOf(100, 2.5)).toThrow(RangeError);
	});
});

describe('withBookingFee', () => {
	it('adds the student booking fee on top', () => {
		expect(withBookingFee(8000, 500)).toBe(8400);
		expect(withBookingFee(5600, 500)).toBe(5880);
		expect(withBookingFee(8000, 0)).toBe(8000);
	});

	it('never makes a cheaper tutor price a dearer student price', () => {
		let previous = -1;
		for (let cents = 0; cents <= 5000; cents++) {
			const pays = withBookingFee(cents, 500);
			expect(pays).toBeGreaterThanOrEqual(previous);
			previous = pays;
		}
	});
});

describe('splitCharge', () => {
	it('splits a $80 tutor price under 5% + 5%', () => {
		expect(splitCharge(8000, RATES)).toEqual({
			tutorPriceCents: 8000,
			bookingFeeCents: 400,
			studentPaysCents: 8400,
			platformFeeCents: 400,
			tutorPayoutCents: 7600,
			platformKeepsCents: 800
		});
	});

	it('always balances: student pays = tutor payout + platform keeps', () => {
		for (const cents of [0, 1, 9, 10, 11, 99, 4410, 4390, 12345, 19999]) {
			for (const rates of [RATES, { studentFeeBps: 0, platformFeeBps: 1000 }]) {
				const s = splitCharge(cents, rates);
				expect(s.studentPaysCents).toBe(s.tutorPayoutCents + s.platformKeepsCents);
				expect(s.studentPaysCents).toBe(withBookingFee(cents, rates.studentFeeBps));
			}
		}
	});
});
