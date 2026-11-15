// Fees, in integer cents. Two fees, both in basis points on the pricing scheme:
//
//   tutor price      what the tutor's rate and the group-size discount give (domain/tierPricing.ts)
//   + booking fee    student_fee_bps of the tutor price, paid by the student
//   = student pays   the ONLY number a student ever sees (ACL single-price rule: mandatory fees
//                    must be inside the displayed price)
//
//   tutor price
//   - platform fee   platform_fee_bps of the tutor price, taken from the tutor's share
//   = tutor payout
//
// The platform keeps booking fee + platform fee (Stripe's application_fee_amount, later).
// Bookings store TUTOR prices (price cap, final price); fees are derived from them when shown or
// charged. Because withBookingFee only ever grows with its input, the cheaper tutor price is
// always the cheaper student price, so the price cap rule works the same on either.

export interface FeeRates {
	/** Added on top of the tutor price, paid by the student. */
	studentFeeBps: number;
	/** Taken out of the tutor price, before payout. */
	platformFeeBps: number;
}

export interface ChargeSplit {
	tutorPriceCents: number;
	bookingFeeCents: number;
	/** tutorPriceCents + bookingFeeCents. What the student is charged. */
	studentPaysCents: number;
	platformFeeCents: number;
	/** tutorPriceCents − platformFeeCents. What reaches the tutor. */
	tutorPayoutCents: number;
	/** bookingFeeCents + platformFeeCents. What the platform keeps. */
	platformKeepsCents: number;
}

function assertCents(name: string, value: number) {
	if (!Number.isInteger(value) || value < 0) {
		throw new RangeError(`${name} must be a non-negative integer, got ${value}`);
	}
}

function assertBps(name: string, value: number) {
	if (!Number.isInteger(value) || value < 0 || value > 10_000) {
		throw new RangeError(`${name} must be an integer between 0 and 10000, got ${value}`);
	}
}

/** `bps` of `cents`, rounded to the nearest cent (half up). */
export function basisPointsOf(cents: number, bps: number): number {
	assertCents('cents', cents);
	assertBps('bps', bps);
	return Math.round((cents * bps) / 10_000);
}

/** What a student pays for a tutor price: the tutor price plus the booking fee. */
export function withBookingFee(tutorPriceCents: number, studentFeeBps: number): number {
	return tutorPriceCents + basisPointsOf(tutorPriceCents, studentFeeBps);
}

/**
 * Splits one student's charge. Always holds:
 *   studentPaysCents = tutorPayoutCents + platformKeepsCents
 */
export function splitCharge(tutorPriceCents: number, rates: FeeRates): ChargeSplit {
	const bookingFeeCents = basisPointsOf(tutorPriceCents, rates.studentFeeBps);
	const platformFeeCents = basisPointsOf(tutorPriceCents, rates.platformFeeBps);
	return {
		tutorPriceCents,
		bookingFeeCents,
		studentPaysCents: tutorPriceCents + bookingFeeCents,
		platformFeeCents,
		tutorPayoutCents: tutorPriceCents - platformFeeCents,
		platformKeepsCents: bookingFeeCents + platformFeeCents
	};
}
