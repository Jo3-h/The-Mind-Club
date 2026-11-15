import { asc, desc, inArray, lte } from 'drizzle-orm';
import { db, type Executor } from '../db';
import { pricingSchemes } from '../db/schema/pricing-schemes';
import { pricingTiers } from '../db/schema/pricing-tiers';
import type { FeeRates } from '../domain/feeSplit';
import type { MultiplierTier, PriceSheet } from '../domain/tierPricing';

/** A scheme's curve and both fees: enough to show prices and to split a charge. */
export type SchemeSheet = PriceSheet & FeeRates & { schemeId: string };

const EMPTY_SHEET = (schemeId: string): SchemeSheet => ({
	schemeId,
	tiers: [],
	studentFeeBps: 0,
	platformFeeBps: 0
});

export const Pricing = {
	/** The scheme in force at `at`: latest active_from <= at. */
	async currentScheme(params: { at?: Date; tx?: Executor } = {}) {
		const { at = new Date(), tx = db } = params;
		const [row] = await tx
			.select()
			.from(pricingSchemes)
			.where(lte(pricingSchemes.activeFrom, at))
			.orderBy(desc(pricingSchemes.activeFrom))
			.limit(1);
		return row;
	},

	/**
	 * Price sheets for several schemes, keyed by scheme id. Sessions keep the scheme they were
	 * created under, so an existing session is always priced with its own sheet, never the
	 * current one.
	 */
	async sheetsForSchemes(params: {
		schemeIds: string[];
		tx?: Executor;
	}): Promise<Map<string, SchemeSheet>> {
		const { schemeIds, tx = db } = params;
		const out = new Map<string, SchemeSheet>();
		const ids = [...new Set(schemeIds)];
		if (ids.length === 0) return out;

		const [schemes, tiers] = await Promise.all([
			tx
				.select({
					id: pricingSchemes.id,
					studentFeeBps: pricingSchemes.studentFeeBps,
					platformFeeBps: pricingSchemes.platformFeeBps
				})
				.from(pricingSchemes)
				.where(inArray(pricingSchemes.id, ids)),
			tx
				.select()
				.from(pricingTiers)
				.where(inArray(pricingTiers.schemeId, ids))
				.orderBy(asc(pricingTiers.groupSize))
		]);

		const tiersByScheme = new Map<string, MultiplierTier[]>();
		for (const t of tiers) {
			const list = tiersByScheme.get(t.schemeId) ?? [];
			list.push({ groupSize: t.groupSize, multiplierBps: t.multiplierBps });
			tiersByScheme.set(t.schemeId, list);
		}
		for (const s of schemes) {
			out.set(s.id, {
				schemeId: s.id,
				tiers: tiersByScheme.get(s.id) ?? [],
				studentFeeBps: s.studentFeeBps,
				platformFeeBps: s.platformFeeBps
			});
		}
		return out;
	},

	/**
	 * The current scheme's sheet plus sheets for `schemeIds` (e.g. existing sessions'), in one go.
	 * `current` is an empty sheet (no tiers, so every price comes out null) if no scheme exists.
	 */
	async sheetsWithCurrent(params: { at?: Date; schemeIds?: string[]; tx?: Executor } = {}) {
		const { at = new Date(), schemeIds = [], tx = db } = params;
		const scheme = await Pricing.currentScheme({ at, tx });
		const sheets = await Pricing.sheetsForSchemes({
			schemeIds: scheme ? [scheme.id, ...schemeIds] : schemeIds,
			tx
		});
		const current = scheme ? (sheets.get(scheme.id) ?? EMPTY_SHEET(scheme.id)) : null;
		return {
			current,
			/** The sheet for a scheme id; an empty one if it's somehow missing. */
			sheetFor: (schemeId: string) => sheets.get(schemeId) ?? EMPTY_SHEET(schemeId)
		};
	}
};
