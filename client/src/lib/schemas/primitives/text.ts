import * as z from 'zod';
import type { LengthConstraint } from '$lib/constants/shared';

/** Trimmed text that must be present, within `c`. */
export const RequiredText = (label: string, c: LengthConstraint) =>
	z
		.string({ error: `${label} is required` })
		.trim()
		.min(
			Math.max(1, c.MIN),
			c.MIN > 1 ? `${label} must be at least ${c.MIN} characters` : `${label} is required`
		)
		.max(c.MAX, `${label} must be ${c.MAX} characters or fewer`);

/** Trimmed text that may be empty or missing; '' and missing become null. */
export const OptionalText = (label: string, c: LengthConstraint) =>
	z
		.string()
		.trim()
		.max(c.MAX, `${label} must be ${c.MAX} characters or fewer`)
		.optional()
		.transform((v) => (v ? v : null));
