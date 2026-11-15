import type { Constraint } from './shared';

/**
 * A tutor's base rate: 1 student × 60 minutes, in integer cents (AUD).
 * Tutors enter dollars (up to 2 decimal places); it's stored as cents.
 */
export const TUTOR_HOURLY_RATE_CENTS: Constraint = Object.freeze({
	MIN: 30_00,
	MAX: 200_00,
	STEP: 1
});
