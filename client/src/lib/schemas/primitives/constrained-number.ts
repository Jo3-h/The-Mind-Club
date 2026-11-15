import * as z from 'zod';
import type { Constraint } from '$lib/constants/shared';
import { NumberLike } from './number-like';

export const ConstrainedNumberLike = (label: string, c: Constraint) =>
	NumberLike(label).pipe(
		z
			.number()
			.max(c.MAX, `${label} should be at most ${c.MAX}`)
			.min(c.MIN, `${label} should be at least ${c.MIN}`)
	);
