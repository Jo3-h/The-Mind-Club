import { describe, expect, it } from 'vitest';
import {
	filterJoinableSessions,
	groupFits,
	isOpenForJoining,
	rankTutors,
	sessionDeliveryFits,
	tutorDeliveryFits,
	type SessionCandidate,
	type StudentMatchContext,
	type TutorCandidate
} from './matching';

// Thu 15 Jan 2026, 09:00 in Adelaide (UTC+10:30, daylight saving)
const NOW = new Date('2026-01-14T22:30:00Z');

const student: StudentMatchContext = {
	topicIds: ['t1', 't2', 't3'],
	// Tue and Thu 4–7pm
	availability: [
		{ day: 2, start: 960, end: 1140 },
		{ day: 4, start: 960, end: 1140 }
	],
	timeZone: 'Australia/Adelaide',
	deliveryPreference: 'online',
	groupPreference: 'any'
};

describe('preference checks', () => {
	it('matches delivery preference against teaching mode', () => {
		expect(tutorDeliveryFits('online', 'online')).toBe(true);
		expect(tutorDeliveryFits('online', 'both')).toBe(true);
		expect(tutorDeliveryFits('online', 'in_person')).toBe(false);
		expect(tutorDeliveryFits('in_person', 'online')).toBe(false);
		expect(tutorDeliveryFits('either', 'in_person')).toBe(true);
	});

	it('matches delivery preference against session location', () => {
		expect(sessionDeliveryFits('online', 'online')).toBe(true);
		expect(sessionDeliveryFits('online', 'public_venue')).toBe(false);
		expect(sessionDeliveryFits('in_person', 'tutor_venue')).toBe(true);
		expect(sessionDeliveryFits('in_person', 'online')).toBe(false);
		expect(sessionDeliveryFits('either', 'public_venue')).toBe(true);
	});

	it('matches group preference against capacity', () => {
		expect(groupFits('one_on_one', 1)).toBe(true);
		expect(groupFits('one_on_one', 2)).toBe(false);
		expect(groupFits('small', 3)).toBe(true);
		expect(groupFits('small', 4)).toBe(false);
		expect(groupFits('any', 6)).toBe(true);
	});
});

describe('rankTutors', () => {
	const tutor = (overrides: Partial<TutorCandidate> & { id: string }): TutorCandidate => ({
		teachingMode: 'online',
		timeZone: 'Australia/Adelaide',
		availability: [{ day: 2, start: 960, end: 1080 }],
		coveredTopicIds: ['t1'],
		...overrides
	});

	it('drops tutors with no shared topic, no shared time, or the wrong format', () => {
		const ranked = rankTutors(
			student,
			[
				tutor({ id: 'ok' }),
				tutor({ id: 'no-topic', coveredTopicIds: ['other'] }),
				tutor({ id: 'no-time', availability: [{ day: 1, start: 960, end: 1080 }] }),
				tutor({ id: 'in-person', teachingMode: 'in_person' })
			],
			NOW
		);
		expect(ranked.map((r) => r.tutor.id)).toEqual(['ok']);
		expect(ranked[0].overlaps).toEqual([{ day: 2, start: 960, end: 1080 }]);
		expect(ranked[0].overlapMinutes).toBe(120);
	});

	it('ranks by topics covered, then shared time', () => {
		const ranked = rankTutors(
			student,
			[
				tutor({ id: 'one-topic-long', availability: student.availability }),
				tutor({ id: 'two-topics-short', coveredTopicIds: ['t1', 't2'] }),
				tutor({
					id: 'two-topics-long',
					coveredTopicIds: ['t1', 't2', 'not-wanted'],
					availability: student.availability
				})
			],
			NOW
		);
		expect(ranked.map((r) => r.tutor.id)).toEqual([
			'two-topics-long',
			'two-topics-short',
			'one-topic-long'
		]);
	});

	it("shifts a tutor's hours into the student's timezone", () => {
		// Sydney is 30 min ahead of Adelaide: Sydney Tue 4:30–6:30pm = Adelaide Tue 4–6pm
		const ranked = rankTutors(
			student,
			[
				tutor({
					id: 'sydney',
					timeZone: 'Australia/Sydney',
					availability: [{ day: 2, start: 990, end: 1110 }]
				})
			],
			NOW
		);
		expect(ranked[0].overlaps).toEqual([{ day: 2, start: 960, end: 1080 }]);
	});
});

describe('filterJoinableSessions', () => {
	// Tue 20 Jan 2026 4:30pm Adelaide = 06:00Z
	const tuesday430 = new Date('2026-01-20T06:00:00Z');
	const session = (overrides: Partial<SessionCandidate> & { id: string }): SessionCandidate => ({
		topicId: 't1',
		startsAt: tuesday430,
		durationMinutes: 60,
		capacity: 4,
		seatsTaken: 1,
		locationType: 'online',
		...overrides
	});

	it('keeps sessions that fit and drops the ones that do not', () => {
		const result = filterJoinableSessions(
			student,
			[
				session({ id: 'ok' }),
				session({ id: 'other-topic', topicId: 'zzz' }),
				session({ id: 'full', seatsTaken: 4 }),
				session({ id: 'in-person', locationType: 'public_venue' }),
				session({ id: 'student-home', locationType: 'student_home' }),
				// starts within 24h → locked (D1)
				session({ id: 'locked', startsAt: new Date(NOW.getTime() + 23 * 3600 * 1000) }),
				// Tue 6:30pm + 60 min runs past the 7pm window end
				session({ id: 'runs-late', startsAt: new Date('2026-01-20T08:00:00Z') }),
				// Mon is not a free day
				session({ id: 'monday', startsAt: new Date('2026-01-19T06:00:00Z') })
			],
			NOW
		);
		expect(result.map((s) => s.id)).toEqual(['ok']);
	});

	it('respects group preference', () => {
		const sessions = [session({ id: 'big', capacity: 6 }), session({ id: 'small', capacity: 3 })];
		expect(
			filterJoinableSessions({ ...student, groupPreference: 'small' }, sessions, NOW).map(
				(s) => s.id
			)
		).toEqual(['small']);
	});

	it('sorts soonest first', () => {
		const later = new Date('2026-01-22T06:00:00Z'); // Thu 4:30pm
		const result = filterJoinableSessions(
			student,
			[session({ id: 'thu', startsAt: later }), session({ id: 'tue' })],
			NOW
		);
		expect(result.map((s) => s.id)).toEqual(['tue', 'thu']);
	});
});

describe('isOpenForJoining', () => {
	const base = {
		locationType: 'online' as const,
		startsAt: new Date(NOW.getTime() + 48 * 3600 * 1000),
		seatsTaken: 1,
		capacity: 4
	};
	it('is true for an upcoming session with a seat', () => {
		expect(isOpenForJoining(base, NOW)).toBe(true);
	});
	it('is false when locked, full, or at a student home', () => {
		expect(
			isOpenForJoining({ ...base, startsAt: new Date(NOW.getTime() + 3600 * 1000) }, NOW)
		).toBe(false);
		expect(isOpenForJoining({ ...base, seatsTaken: 4 }, NOW)).toBe(false);
		expect(isOpenForJoining({ ...base, locationType: 'student_home' }, NOW)).toBe(false);
	});
});
