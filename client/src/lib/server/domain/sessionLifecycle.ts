// Session and booking lifecycles, matching the DB enums (db/schema/enums.ts):
//
//   session_status: scheduled → completed | cancelled
//   booking_status: pending → confirmed | cancelled
//                   confirmed → cancelled | attended | no_show
//
// "Locked" is NOT stored. It is derived from the clock (D1), so nothing has to run at the lock
// time and no row can be "open" by mistake after it. sessionPhase() is the one place that
// decides it. "Charged" arrives with payments, on the payments table.
//
// Plain string unions (not imported from the schema) keep this file free of DB imports; they must
// stay in step with the enums.

import { LOCK_HOURS_BEFORE_START } from '../../constants/sessions';

export type SessionStatus = 'scheduled' | 'completed' | 'cancelled';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'attended' | 'no_show';

/**
 * Where a session is right now:
 *   open         scheduled, before the lock: students can join and leave
 *   locked       scheduled, inside the lock window: group size is final
 *   in_progress  scheduled, between start and end
 *   finished     scheduled, past its end, waiting for the tutor to mark it complete
 *   completed / cancelled   stored end states
 */
export type SessionPhase =
	'open' | 'locked' | 'in_progress' | 'finished' | 'completed' | 'cancelled';

const HOUR_MS = 60 * 60 * 1000;

/** When a session starting at `startsAt` locks. */
export function lockTimeFor(startsAt: Date): Date {
	return new Date(startsAt.getTime() - LOCK_HOURS_BEFORE_START * HOUR_MS);
}

export function sessionPhase(
	session: { status: SessionStatus; startsAt: Date; endsAt: Date },
	now: Date = new Date()
): SessionPhase {
	if (session.status !== 'scheduled') return session.status;
	const t = now.getTime();
	if (t < lockTimeFor(session.startsAt).getTime()) return 'open';
	if (t < session.startsAt.getTime()) return 'locked';
	if (t < session.endsAt.getTime()) return 'in_progress';
	return 'finished';
}

// ---------------- transitions ----------------

const SESSION_TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
	scheduled: ['completed', 'cancelled'],
	completed: [],
	cancelled: []
};

const BOOKING_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
	pending: ['confirmed', 'cancelled'],
	confirmed: ['cancelled', 'attended', 'no_show'],
	cancelled: [],
	attended: [],
	no_show: []
};

export function canTransitionSession(from: SessionStatus, to: SessionStatus): boolean {
	return SESSION_TRANSITIONS[from].includes(to);
}

export function canTransitionBooking(from: BookingStatus, to: BookingStatus): boolean {
	return BOOKING_TRANSITIONS[from].includes(to);
}

/** A session can only be marked complete once it has ended. */
export function canCompleteSession(
	session: { status: SessionStatus; startsAt: Date; endsAt: Date },
	now: Date = new Date()
): boolean {
	return sessionPhase(session, now) === 'finished';
}

/** A student can leave (cancel their own booking) only while the session is open (D1). */
export function canLeaveSession(
	session: { status: SessionStatus; startsAt: Date; endsAt: Date },
	booking: { status: BookingStatus },
	now: Date = new Date()
): boolean {
	return sessionPhase(session, now) === 'open' && canTransitionBooking(booking.status, 'cancelled');
}
