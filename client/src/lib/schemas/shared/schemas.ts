import type { Constraint } from '$lib/constants/shared';
import * as z from 'zod';

export const NumberLike = (label: string) =>
	z
		.union([z.number(), z.string().trim()])
		.transform((data) => {
			if (typeof data === 'string') {
				return Number(data);
			}
			return data;
		})
		.pipe(z.number());

export const ConstrainedNumberLike = (label: string, c: Constraint) =>
	NumberLike(label).pipe(
		z
			.number()
			.max(c.MAX, `${label} should be at least ${c.MAX}`)
			.min(c.MIN, `${label} should be at least ${c.MIN}`)
	);
