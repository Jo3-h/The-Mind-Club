import { pgTable, uuid, smallint, integer, primaryKey, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pricingSchemes } from './pricing-schemes';

/**
 * The discount curve: what each student pays, as a fraction of the tutor's base rate,
 * at a given group size. Basis points, so no floats ever touch money.
 *
 *   group_size 1 → 10000  (100%)   tutor earns 1.00× base
 *   group_size 2 →  7000  (70%)    tutor earns 1.40×
 *   group_size 3 →  5500  (55%)    tutor earns 1.65×
 *   group_size 4 →  4750  (47.5%)  tutor earns 1.90×
 *
 * per-student price = round(base_rate_cents × duration_min/60 × multiplier_bps/10000)
 * Sizes above the largest tier use the largest tier.
 */
export const pricingTiers = pgTable(
	'pricing_tiers',
	{
		schemeId: uuid('scheme_id')
			.notNull()
			.references(() => pricingSchemes.id, { onDelete: 'cascade' }),
		groupSize: smallint('group_size').notNull(),
		multiplierBps: integer('multiplier_bps').notNull()
	},
	(t) => [
		primaryKey({ columns: [t.schemeId, t.groupSize] }),
		check('pt_size_chk', sql`${t.groupSize} >= 1`),
		check('pt_mult_chk', sql`${t.multiplierBps} between 1 and 10000`)
	]
);
