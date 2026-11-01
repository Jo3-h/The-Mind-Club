// Pure platform-fee calculation. Per D3 (docs/MVP_BRIEF.md), the 10% platform
// fee is taken out of the tutor's share — the student is charged the full
// per-student price, and the fee is deducted before the tutor is paid out via
// the Stripe Connect Express destination charge's application_fee_amount.

import { PLATFORM_FEE_BASIS_POINTS } from './constants';

export interface FeeSplit {
	amountCents: number;
	platformFeeCents: number;
	tutorAmountCents: number;
}

/**
 * Splits a single participant's charge amount into the platform's fee and
 * the tutor's share. `platformFeeCents + tutorAmountCents === amountCents`
 * always holds (fee is rounded to the nearest cent; any rounding remainder
 * stays with the tutor's share).
 */
export function splitPaymentCents(amountCents: number): FeeSplit {
	if (!Number.isInteger(amountCents) || amountCents < 0) {
		throw new RangeError(`amountCents must be a non-negative integer, got ${amountCents}`);
	}

	const platformFeeCents = Math.round((amountCents * PLATFORM_FEE_BASIS_POINTS) / 10_000);
	const tutorAmountCents = amountCents - platformFeeCents;

	return { amountCents, platformFeeCents, tutorAmountCents };
}
