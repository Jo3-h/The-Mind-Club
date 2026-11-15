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
		.pipe(z.number({ error: `${label} must be a number` }));
