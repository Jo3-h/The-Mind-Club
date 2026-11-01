// Shared platform constants for pricing and session-lifecycle domain logic.
// Kept dependency-free (no db/schema imports) so the DB schema can import
// these without creating a cycle, and so domain functions stay pure.

/** Smallest group size a first booker can publish a session with (D7). */
export const MIN_GROUP_SIZE = 2;

/** Largest group size a first booker can publish a session with (D7). */
export const MAX_GROUP_SIZE = 6;

/** Hours before a session's start time at which it locks to new joiners (D1). */
export const LOCK_HOURS_BEFORE_START = 24;

/** Platform fee, in basis points of the per-student charge, taken from the tutor's share (D3). */
export const PLATFORM_FEE_BASIS_POINTS = 1000; // 10%
