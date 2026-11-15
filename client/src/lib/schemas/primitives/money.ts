import * as z from 'zod';
import type { Constraint } from '$lib/constants/shared';
import { dollarsToCents, formatCents } from '$lib/utils/money';

/**
 * A dollar amount typed into a form ("65", "65.50") → integer cents, within `c` (in cents).
 * Parsed as a string, so floats never touch the amount.
 */
export const DollarsAsCents = (label: string, c: Constraint) =>
	z
		.string({ error: `${label} is required` })
		.transform((raw, ctx) => {
			const cents = dollarsToCents(raw);
			if (cents === null) {
				ctx.addIssue({
					code: 'custom',
					message: `${label} must be a dollar amount, e.g. 65 or 65.50`
				});
				return z.NEVER;
			}
			return cents;
		})
		.pipe(
			z
				.number()
				.int()
				.min(c.MIN, `${label} must be at least ${formatCents(c.MIN)}`)
				.max(c.MAX, `${label} must be at most ${formatCents(c.MAX)}`)
		);
