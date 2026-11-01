// Pure session lifecycle state machine.
//
// docs/MVP_BRIEF.md describes a simplified 4-state lifecycle:
//   open -> locked -> completed -> charged (+ cancelled from open/locked)
//
// The existing `sessionStatusEnum` in src/lib/server/db/schema.ts (predates
// this phase) models the payment-settlement side in more detail so that a
// failed/disputed charge doesn't silently look "done":
//   open -> locked -> in_progress -> completed -> settling -> settled
//                                                           -> settlement_failed
//                                            settled -> disputed
//   open | locked -> cancelled
//
// ASSUMPTION: `settled` is the brief's "charged" state, and `settling` /
// `settlement_failed` / `disputed` are implementation detail for the
// charge-webhook pipeline (Phase 5). `settlement_failed` can retry back to
// `settling`. Kept here as a plain string union (not imported from
// schema.ts) so this file has zero DB dependencies and stays pure — the
// values must stay in sync with `sessionStatusEnum` in schema.ts.

export type SessionStatus =
	| 'open'
	| 'locked'
	| 'in_progress'
	| 'completed'
	| 'settling'
	| 'settled'
	| 'settlement_failed'
	| 'disputed'
	| 'cancelled';

const ALLOWED_TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
	open: ['locked', 'cancelled'],
	locked: ['in_progress', 'cancelled'],
	in_progress: ['completed'],
	completed: ['settling'],
	settling: ['settled', 'settlement_failed'],
	settled: ['disputed'],
	settlement_failed: ['settling'],
	disputed: [],
	cancelled: []
};

/** Returns true if transitioning a session from `from` to `to` is allowed. */
export function canTransitionSessionStatus(from: SessionStatus, to: SessionStatus): boolean {
	return ALLOWED_TRANSITIONS[from].includes(to);
}

export class InvalidSessionTransitionError extends Error {
	constructor(from: SessionStatus, to: SessionStatus) {
		super(`Invalid session status transition: ${from} -> ${to}`);
		this.name = 'InvalidSessionTransitionError';
	}
}

/**
 * Returns the new status if the transition is valid, otherwise throws
 * `InvalidSessionTransitionError`. Callers persist the returned value.
 */
export function transitionSessionStatus(from: SessionStatus, to: SessionStatus): SessionStatus {
	if (!canTransitionSessionStatus(from, to)) {
		throw new InvalidSessionTransitionError(from, to);
	}
	return to;
}
