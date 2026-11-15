// Per-student price under the schema's pricing model (db/schema/pricing-tiers.ts):
//
//   per-student price = round(base_rate_cents × duration_min/60 × multiplier_bps/10000)
//
// where the multiplier depends on the group size. Sizes above the largest tier use the
// largest tier. All integer maths, so no floats touch money until the final rounding.
//
// That is the TUTOR price. Everything a student is shown adds the booking fee (domain/feeSplit.ts)
// through a PriceSheet, so the "student…" functions below are the only ones UI code should use.

import { withBookingFee } from './feeSplit';

export interface MultiplierTier {
	groupSize: number;
	multiplierBps: number;
}

/**
 * The multiplier for a group of `groupSize` students: the tier for that exact size, or the
 * largest tier below it. Returns null if there's no tier at or below that size.
 */
export function multiplierForGroupSize(
	tiers: readonly MultiplierTier[],
	groupSize: number
): number | null {
	let best: MultiplierTier | null = null;
	for (const t of tiers) {
		if (t.groupSize <= groupSize && (!best || t.groupSize > best.groupSize)) best = t;
	}
	return best?.multiplierBps ?? null;
}

/** Per-student price in cents for one session. */
export function perStudentPriceCents(params: {
	baseRateCents: number;
	durationMinutes: number;
	multiplierBps: number;
}): number {
	const { baseRateCents, durationMinutes, multiplierBps } = params;
	if (!Number.isInteger(baseRateCents) || baseRateCents < 0) {
		throw new RangeError('baseRateCents must be a non-negative integer');
	}
	if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
		throw new RangeError('durationMinutes must be a positive integer');
	}
	if (!Number.isInteger(multiplierBps) || multiplierBps <= 0) {
		throw new RangeError('multiplierBps must be a positive integer');
	}
	// 60 minutes × 10000 bps = 600000
	return Math.round((baseRateCents * durationMinutes * multiplierBps) / 600000);
}

/** Per-student price for a session at a given group size, or null if no tier applies. */
export function priceAtGroupSize(params: {
	tiers: readonly MultiplierTier[];
	baseRateCents: number;
	durationMinutes: number;
	groupSize: number;
}): number | null {
	const multiplierBps = multiplierForGroupSize(params.tiers, params.groupSize);
	if (multiplierBps === null) return null;
	return perStudentPriceCents({
		baseRateCents: params.baseRateCents,
		durationMinutes: params.durationMinutes,
		multiplierBps
	});
}

/** One pricing scheme, as needed to show students prices: the curve plus the booking fee. */
export interface PriceSheet {
	tiers: readonly MultiplierTier[];
	studentFeeBps: number;
}

/** What one student pays for a session at a given group size, fee included. Null without a tier. */
export function studentPriceAtGroupSize(params: {
	sheet: PriceSheet;
	baseRateCents: number;
	durationMinutes: number;
	groupSize: number;
}): number | null {
	const tutorPrice = priceAtGroupSize({ ...params, tiers: params.sheet.tiers });
	return tutorPrice === null ? null : withBookingFee(tutorPrice, params.sheet.studentFeeBps);
}

/**
 * The cheapest an hour gets with this tutor, fee included: a full group at `maxGroupSize`.
 * Shown as "from $X per student" in browse. Null if the rate or tiers are missing.
 */
export function lowestHourlyPricePerStudent(params: {
	sheet: PriceSheet;
	baseRateCents: number | null;
	maxGroupSize: number;
}): number | null {
	if (params.baseRateCents === null) return null;
	return studentPriceAtGroupSize({
		sheet: params.sheet,
		baseRateCents: params.baseRateCents,
		durationMinutes: 60,
		groupSize: params.maxGroupSize
	});
}

/**
 * What each student pays (fee included) at every group size from 1 up to `maxGroupSize`.
 * This is the product's core mechanic made visible: the bigger the group, the cheaper.
 * Sizes with no applicable tier are skipped. Empty when there's no rate.
 */
export function priceLadder(params: {
	sheet: PriceSheet;
	baseRateCents: number | null;
	durationMinutes: number;
	maxGroupSize: number;
}): { groupSize: number; pricePerStudentCents: number }[] {
	const { sheet, baseRateCents, durationMinutes, maxGroupSize } = params;
	if (baseRateCents === null) return [];
	const out: { groupSize: number; pricePerStudentCents: number }[] = [];
	for (let groupSize = 1; groupSize <= maxGroupSize; groupSize++) {
		const price = studentPriceAtGroupSize({ sheet, baseRateCents, durationMinutes, groupSize });
		if (price !== null) out.push({ groupSize, pricePerStudentCents: price });
	}
	return out;
}

/**
 * The live price block for one session, per student, fee included:
 *   now          at the current group (a lone student is a group of 1)
 *   ifOneMore    if one more student joins; null when that would exceed capacity
 *   lowest       if every seat fills
 * Null when the scheme has no tiers.
 */
export function sessionPrices(params: {
	sheet: PriceSheet;
	baseRateCents: number;
	durationMinutes: number;
	/** pricingGroupSize(): confirmed students. */
	groupSize: number;
	capacity: number;
}): { nowCents: number; ifOneMoreCents: number | null; lowestCents: number } | null {
	const { groupSize, capacity, ...rest } = params;
	const at = (size: number) => studentPriceAtGroupSize({ ...rest, groupSize: size });
	const nowCents = at(Math.max(1, groupSize));
	const lowestCents = at(Math.max(1, capacity));
	if (nowCents === null || lowestCents === null) return null;
	return {
		nowCents,
		ifOneMoreCents: groupSize + 1 <= capacity ? at(groupSize + 1) : null,
		lowestCents
	};
}
