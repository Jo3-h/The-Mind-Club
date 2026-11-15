import { describe, expect, it } from 'vitest';
import {
	getJoinabilityReason,
	isJoinable,
	pricingGroupSize,
	seatsHeld,
	type JoinableSession
} from './joinability';

const NOW = new Date('2026-11-14T00:00:00Z');
const inHours = (h: number) => new Date(NOW.getTime() + h * 3600 * 1000);

const session: JoinableSession = {
	status: 'scheduled',
	visibility: 'open',
	locationType: 'public_venue',
	startsAt: inHours(48),
	capacity: 4,
	seatsTaken: 2
};

describe('getJoinabilityReason', () => {
	it('is joinable when open, before the lock, with a seat left', () => {
		expect(getJoinabilityReason(session, null, NOW)).toBe('joinable');
		expect(isJoinable(session, { alreadyBooked: false }, NOW)).toBe(true);
	});

	it('never lets anyone into a session at a student home, or a private one (D6)', () => {
		expect(
			getJoinabilityReason(
				{ ...session, locationType: 'student_home', visibility: 'private' },
				null,
				NOW
			)
		).toBe('private');
		expect(getJoinabilityReason({ ...session, visibility: 'private' }, null, NOW)).toBe('private');
	});

	it('is unavailable once cancelled or completed', () => {
		expect(getJoinabilityReason({ ...session, status: 'cancelled' }, null, NOW)).toBe(
			'unavailable'
		);
		expect(getJoinabilityReason({ ...session, status: 'completed' }, null, NOW)).toBe(
			'unavailable'
		);
	});

	it('locks 24 hours before the start (D1)', () => {
		expect(getJoinabilityReason({ ...session, startsAt: inHours(24.01) }, null, NOW)).toBe(
			'joinable'
		);
		expect(getJoinabilityReason({ ...session, startsAt: inHours(24) }, null, NOW)).toBe('locked');
		expect(getJoinabilityReason({ ...session, startsAt: inHours(-1) }, null, NOW)).toBe('locked');
	});

	it('spots a student who already has a seat before saying it is full', () => {
		expect(getJoinabilityReason({ ...session, seatsTaken: 4 }, { alreadyBooked: true }, NOW)).toBe(
			'already_booked'
		);
	});

	it('is full when every seat is held (D7)', () => {
		expect(getJoinabilityReason({ ...session, seatsTaken: 4 }, null, NOW)).toBe('full');
		expect(getJoinabilityReason({ ...session, seatsTaken: 3 }, null, NOW)).toBe('joinable');
	});
});

describe('seat counting', () => {
	const bookings = [
		{ status: 'confirmed' as const, expiresAt: null },
		{ status: 'pending' as const, expiresAt: inHours(1) },
		{ status: 'pending' as const, expiresAt: inHours(-1) }, // expired
		{ status: 'pending' as const, expiresAt: null },
		{ status: 'cancelled' as const, expiresAt: null }
	];

	it('seatsHeld counts confirmed and unexpired pending', () => {
		expect(seatsHeld(bookings, NOW)).toBe(3);
	});

	it('pricingGroupSize counts only students actually in the group', () => {
		expect(pricingGroupSize(bookings)).toBe(1);
		expect(
			pricingGroupSize([{ status: 'attended' }, { status: 'no_show' }, { status: 'cancelled' }])
		).toBe(2);
	});
});
