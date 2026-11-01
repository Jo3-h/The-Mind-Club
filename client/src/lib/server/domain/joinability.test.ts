import { describe, expect, it } from 'vitest';
import {
	getJoinabilityReason,
	isSessionJoinableByStudent,
	type JoinabilityParticipant,
	type JoinabilitySession
} from './joinability';

const now = new Date('2026-01-01T00:00:00Z');
const future = new Date('2026-01-02T00:00:00Z');
const past = new Date('2025-12-31T00:00:00Z');

function makeSession(overrides: Partial<JoinabilitySession> = {}): JoinabilitySession {
	return {
		status: 'open',
		lockAt: future,
		groupSizeLimit: 4,
		locationType: 'online',
		...overrides
	};
}

const participants: JoinabilityParticipant[] = [
	{ userId: 'student-1', status: 'booked' },
	{ userId: 'student-2', status: 'cancelled' }
];

describe('getJoinabilityReason', () => {
	it('is joinable when open, before lock, has room, and not already joined', () => {
		expect(getJoinabilityReason(makeSession(), participants, 'student-3', now)).toBe('joinable');
	});

	it('blocks joining a tutor_residence session regardless of other factors', () => {
		const session = makeSession({ locationType: 'tutor_residence' });
		expect(getJoinabilityReason(session, [], 'student-3', now)).toBe('location_not_joinable');
	});

	it('blocks joining when session is not open', () => {
		const session = makeSession({ status: 'locked' });
		expect(getJoinabilityReason(session, participants, 'student-3', now)).toBe('session_not_open');
	});

	it('blocks joining once the lock time has passed, even if status is still open', () => {
		const session = makeSession({ lockAt: past });
		expect(getJoinabilityReason(session, participants, 'student-3', now)).toBe('session_locked');
	});

	it('blocks a student who already has an active booking', () => {
		expect(getJoinabilityReason(makeSession(), participants, 'student-1', now)).toBe(
			'already_joined'
		);
	});

	it('allows rejoining after cancelling', () => {
		expect(getJoinabilityReason(makeSession(), participants, 'student-2', now)).toBe('joinable');
	});

	it('blocks joining a full session', () => {
		const session = makeSession({ groupSizeLimit: 1 });
		expect(getJoinabilityReason(session, participants, 'student-3', now)).toBe('session_full');
	});
});

describe('isSessionJoinableByStudent', () => {
	it('returns true only for the joinable reason', () => {
		expect(isSessionJoinableByStudent(makeSession(), participants, 'student-3', now)).toBe(true);
		expect(
			isSessionJoinableByStudent(
				makeSession({ status: 'cancelled' }),
				participants,
				'student-3',
				now
			)
		).toBe(false);
	});
});
