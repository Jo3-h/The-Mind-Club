// Can a student join this session right now? One rule, used by search, profiles, the session
// page and (inside a locked transaction) the join action. Decisions D1, D6, D7.

import { lockTimeFor, type BookingStatus, type SessionStatus } from './sessionLifecycle';

export type LocationType = 'online' | 'tutor_venue' | 'public_venue' | 'student_home';
export type SessionVisibility = 'open' | 'private';

export interface JoinableSession {
	status: SessionStatus;
	visibility: SessionVisibility;
	locationType: LocationType;
	startsAt: Date;
	capacity: number;
	/** Seats held: confirmed + unexpired pending (see seatsHeld). */
	seatsTaken: number;
}

export type JoinabilityReason =
	| 'joinable'
	| 'private' // a student's home (D6) or a private session
	| 'unavailable' // cancelled or completed
	| 'locked' // inside the lock window or already started (D1)
	| 'already_booked'
	| 'full';

export interface BookingSeat {
	status: BookingStatus;
	expiresAt: Date | null;
}

/** Seats held right now: confirmed bookings plus pending ones that haven't expired. */
export function seatsHeld(bookings: readonly BookingSeat[], now: Date = new Date()): number {
	return bookings.filter(
		(b) =>
			b.status === 'confirmed' ||
			(b.status === 'pending' && (b.expiresAt === null || b.expiresAt.getTime() > now.getTime()))
	).length;
}

/**
 * Group size for pricing: students who are actually in the group. Pending seats don't count
 * (they may never pay); attended / no-show do (they only exist once the session is over).
 */
export function pricingGroupSize(bookings: readonly Pick<BookingSeat, 'status'>[]): number {
	return bookings.filter(
		(b) => b.status === 'confirmed' || b.status === 'attended' || b.status === 'no_show'
	).length;
}

/**
 * 'joinable', or the first reason it isn't. `viewer` is null when asking "can anyone join?"
 * (search, listings); pass whether this student already holds a seat when they try to join.
 */
export function getJoinabilityReason(
	session: JoinableSession,
	viewer: { alreadyBooked: boolean } | null,
	now: Date = new Date()
): JoinabilityReason {
	if (session.locationType === 'student_home' || session.visibility === 'private') {
		return 'private';
	}
	if (session.status !== 'scheduled') return 'unavailable';
	if (now.getTime() >= lockTimeFor(session.startsAt).getTime()) return 'locked';
	if (viewer?.alreadyBooked) return 'already_booked';
	if (session.seatsTaken >= session.capacity) return 'full';
	return 'joinable';
}

export function isJoinable(
	session: JoinableSession,
	viewer: { alreadyBooked: boolean } | null,
	now: Date = new Date()
): boolean {
	return getJoinabilityReason(session, viewer, now) === 'joinable';
}
