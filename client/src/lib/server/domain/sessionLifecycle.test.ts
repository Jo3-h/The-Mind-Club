import { describe, expect, it } from 'vitest';
import {
	canCompleteSession,
	canLeaveSession,
	canTransitionBooking,
	canTransitionSession,
	lockTimeFor,
	sessionPhase
} from './sessionLifecycle';

const START = new Date('2026-12-01T06:00:00Z');
const END = new Date('2026-12-01T07:00:00Z');
const session = { status: 'scheduled' as const, startsAt: START, endsAt: END };
const at = (iso: string) => new Date(iso);

describe('lockTimeFor', () => {
	it('is 24 hours before the start', () => {
		expect(lockTimeFor(START).toISOString()).toBe('2026-11-30T06:00:00.000Z');
	});
});

describe('sessionPhase', () => {
	it('is open until the lock time, then locked', () => {
		expect(sessionPhase(session, at('2026-11-30T05:59:59Z'))).toBe('open');
		expect(sessionPhase(session, at('2026-11-30T06:00:00Z'))).toBe('locked');
	});

	it('is in progress from the start, and finished from the end', () => {
		expect(sessionPhase(session, at('2026-12-01T05:59:59Z'))).toBe('locked');
		expect(sessionPhase(session, START)).toBe('in_progress');
		expect(sessionPhase(session, END)).toBe('finished');
	});

	it('reports stored end states whatever the time', () => {
		const early = at('2026-11-01T00:00:00Z');
		expect(sessionPhase({ ...session, status: 'cancelled' }, early)).toBe('cancelled');
		expect(sessionPhase({ ...session, status: 'completed' }, early)).toBe('completed');
	});
});

describe('transitions', () => {
	it('sessions go from scheduled to completed or cancelled, and no further', () => {
		expect(canTransitionSession('scheduled', 'completed')).toBe(true);
		expect(canTransitionSession('scheduled', 'cancelled')).toBe(true);
		expect(canTransitionSession('completed', 'cancelled')).toBe(false);
		expect(canTransitionSession('cancelled', 'scheduled')).toBe(false);
	});

	it('bookings follow pending → confirmed → attended / no-show, cancellable until done', () => {
		expect(canTransitionBooking('pending', 'confirmed')).toBe(true);
		expect(canTransitionBooking('pending', 'cancelled')).toBe(true);
		expect(canTransitionBooking('pending', 'attended')).toBe(false);
		expect(canTransitionBooking('confirmed', 'attended')).toBe(true);
		expect(canTransitionBooking('confirmed', 'no_show')).toBe(true);
		expect(canTransitionBooking('confirmed', 'cancelled')).toBe(true);
		expect(canTransitionBooking('attended', 'cancelled')).toBe(false);
		expect(canTransitionBooking('cancelled', 'confirmed')).toBe(false);
	});
});

describe('canCompleteSession', () => {
	it('only once the session has ended', () => {
		expect(canCompleteSession(session, at('2026-12-01T06:30:00Z'))).toBe(false);
		expect(canCompleteSession(session, END)).toBe(true);
		expect(canCompleteSession({ ...session, status: 'cancelled' }, END)).toBe(false);
	});
});

describe('canLeaveSession', () => {
	const open = at('2026-11-29T00:00:00Z');
	it('allows leaving a live booking before the lock', () => {
		expect(canLeaveSession(session, { status: 'confirmed' }, open)).toBe(true);
		expect(canLeaveSession(session, { status: 'pending' }, open)).toBe(true);
	});
	it('refuses after the lock, or for a booking that is already over', () => {
		expect(canLeaveSession(session, { status: 'confirmed' }, at('2026-11-30T07:00:00Z'))).toBe(
			false
		);
		expect(canLeaveSession(session, { status: 'cancelled' }, open)).toBe(false);
		expect(
			canLeaveSession({ ...session, status: 'cancelled' }, { status: 'confirmed' }, open)
		).toBe(false);
	});
});
