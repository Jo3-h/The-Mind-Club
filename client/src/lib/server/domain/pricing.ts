// Pure pricing lookup. Given the platform's pricing tiers (loaded from the
// `pricingTiers` table) and a published session's group size, returns the
// per-student price for the current number of joined participants.
//
// Price drops as participantCount increases towards groupSize — this is the
// product's core mechanic (see CLAUDE.md).

export interface PricingTier {
	groupSize: number;
	participantCount: number;
	pricePerStudentCents: number;
}

export class PricingTierNotFoundError extends Error {
	constructor(groupSize: number, participantCount: number) {
		super(`No pricing tier found for groupSize=${groupSize}, participantCount=${participantCount}`);
		this.name = 'PricingTierNotFoundError';
	}
}

/**
 * Returns the price per student (in cents) for a session with the given
 * published group size, once `participantCount` students have joined.
 *
 * Throws if `participantCount` is out of range, or if no matching tier
 * exists in `tiers` (callers should ensure the pricing tiers are seeded for
 * every groupSize 2..MAX_GROUP_SIZE / participantCount 1..groupSize pair).
 */
export function getPricePerStudentCents(
	tiers: readonly PricingTier[],
	groupSize: number,
	participantCount: number
): number {
	if (participantCount < 1 || participantCount > groupSize) {
		throw new RangeError(
			`participantCount (${participantCount}) must be between 1 and groupSize (${groupSize})`
		);
	}

	const tier = tiers.find(
		(t) => t.groupSize === groupSize && t.participantCount === participantCount
	);

	if (!tier) {
		throw new PricingTierNotFoundError(groupSize, participantCount);
	}

	return tier.pricePerStudentCents;
}

/**
 * Returns the lowest price per student reachable for a given published group
 * size — i.e. the price once the group is full. Used for the "lowest
 * possible price" line in the live price block (Phase 3).
 */
export function getLowestPricePerStudentCents(
	tiers: readonly PricingTier[],
	groupSize: number
): number {
	return getPricePerStudentCents(tiers, groupSize, groupSize);
}
