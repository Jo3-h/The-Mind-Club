import { describe, expect, it } from 'vitest';
import {
	canTransitionSessionStatus,
	InvalidSessionTransitionError,
	transitionSessionStatus,
	type SessionStatus
} from './sessionLifecycle';

describe('canTransitionSessionStatus', () => {
	it('allows the brief-happy-path transitions', () => {
		expect(canTransitionSessionStatus('open', 'locked')).toBe(true);
		expect(canTransitionSessionStatus('locked', 'in_progress')).toBe(true);
		expect(canTransitionSessionStatus('in_progress', 'completed')).toBe(true);
		expect(canTransitionSessionStatus('completed', 'settling')).toBe(true);
		expect(canTransitionSessionStatus('settling', 'settled')).toBe(true);
	});

	it('allows cancellation from open or locked', () => {
		expect(canTransitionSessionStatus('open', 'cancelled')).toBe(true);
		expect(canTransitionSessionStatus('locked', 'cancelled')).toBe(true);
	});

	it('allows a failed settlement to retry', () => {
		expect(canTransitionSessionStatus('settling', 'settlement_failed')).toBe(true);
		expect(canTransitionSessionStatus('settlement_failed', 'settling')).toBe(true);
	});

	it('allows a dispute to be raised after settlement', () => {
		expect(canTransitionSessionStatus('settled', 'disputed')).toBe(true);
	});

	it('rejects skipping states', () => {
		expect(canTransitionSessionStatus('open', 'completed')).toBe(false);
		expect(canTransitionSessionStatus('open', 'settled')).toBe(false);
	});

	it('rejects cancellation once in progress or later', () => {
		expect(canTransitionSessionStatus('in_progress', 'cancelled')).toBe(false);
		expect(canTransitionSessionStatus('completed', 'cancelled')).toBe(false);
	});

	it('rejects transitions out of terminal states', () => {
		const terminal: SessionStatus[] = ['disputed', 'cancelled'];
		for (const status of terminal) {
			expect(canTransitionSessionStatus(status, 'open')).toBe(false);
		}
	});
});

describe('transitionSessionStatus', () => {
	it('returns the new status for a valid transition', () => {
		expect(transitionSessionStatus('open', 'locked')).toBe('locked');
	});

	it('throws InvalidSessionTransitionError for an invalid transition', () => {
		expect(() => transitionSessionStatus('cancelled', 'open')).toThrow(
			InvalidSessionTransitionError
		);
	});
});
