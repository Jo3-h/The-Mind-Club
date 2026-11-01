// Pure "is this session joinable by this student?" check, per
// docs/MVP_BRIEF.md Phase 1 and decisions D1/D6/D7.

import type { SessionStatus } from './sessionLifecycle';

export type LocationType = 'tutor_residence' | 'classroom' | 'online';

export interface JoinabilitySession {
	status: SessionStatus;
	lockAt: Date;
	groupSizeLimit: number;
	locationType: LocationType;
}

export interface JoinabilityParticipant {
	userId: string;
	/** Only 'cancelled' participants are excluded from the active count. */
	status: 'booked' | 'cancelled' | 'attended' | 'no_show';
}

export type JoinabilityReason =
	| 'joinable'
	| 'location_not_joinable'
	| 'session_not_open'
	| 'session_locked'
	| 'already_joined'
	| 'session_full';

/**
 * Evaluates whether `studentUserId` can join a session right now, returning
 * 'joinable' or the first blocking reason.
 *
 * - D6: sessions at the tutor's residence are private 1:1 bookings and can
 *   never be joined by another student, regardless of status/capacity.
 * - D1: a session stops accepting joins once `now >= lockAt`, even if a
 *   scheduled job hasn't yet flipped `status` to 'locked'.
 * - D7: capacity is `groupSizeLimit`, counting only non-cancelled participants.
 */
export function getJoinabilityReason(
	session: JoinabilitySession,
	participants: readonly JoinabilityParticipant[],
	studentUserId: string,
	now: Date = new Date()
): JoinabilityReason {
	if (session.locationType === 'tutor_residence') {
		return 'location_not_joinable';
	}

	if (session.status !== 'open') {
		return 'session_not_open';
	}

	if (now.getTime() >= session.lockAt.getTime()) {
		return 'session_locked';
	}

	const activeParticipants = participants.filter((p) => p.status !== 'cancelled');

	if (activeParticipants.some((p) => p.userId === studentUserId)) {
		return 'already_joined';
	}

	if (activeParticipants.length >= session.groupSizeLimit) {
		return 'session_full';
	}

	return 'joinable';
}

export function isSessionJoinableByStudent(
	session: JoinabilitySession,
	participants: readonly JoinabilityParticipant[],
	studentUserId: string,
	now: Date = new Date()
): boolean {
	return getJoinabilityReason(session, participants, studentUserId, now) === 'joinable';
}
