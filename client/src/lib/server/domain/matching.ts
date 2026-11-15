// Simple, read-only recommendations for a student straight after onboarding.
// Not a matching engine (out of MVP scope): it only filters and sorts candidates
// that the repository has already narrowed to the student's topics.

import {
	intersectWindows,
	isWithinWindows,
	localWeekdayMinute,
	shiftWindows,
	timeZoneOffsetMinutes,
	totalWindowMinutes,
	type WeeklyWindow
} from './availability';
import { isJoinable } from './joinability';

export type DeliveryPreference = 'online' | 'in_person' | 'either';
export type GroupPreference = 'any' | 'small' | 'one_on_one';
export type TeachingMode = 'online' | 'in_person' | 'both';
export type SessionLocationType = 'online' | 'tutor_venue' | 'public_venue' | 'student_home';

/** Largest capacity that still counts as a "small group" (GROUP_PREFERENCES says 2–3). */
export const SMALL_GROUP_MAX = 3;

export interface StudentMatchContext {
	topicIds: readonly string[];
	availability: readonly WeeklyWindow[];
	timeZone: string;
	deliveryPreference: DeliveryPreference;
	groupPreference: GroupPreference;
}

export function tutorDeliveryFits(pref: DeliveryPreference, mode: TeachingMode): boolean {
	if (pref === 'either' || mode === 'both') return true;
	return pref === mode;
}

export function sessionDeliveryFits(
	pref: DeliveryPreference,
	location: SessionLocationType
): boolean {
	if (pref === 'either') return true;
	return pref === 'online' ? location === 'online' : location !== 'online';
}

export function groupFits(pref: GroupPreference, capacity: number): boolean {
	if (pref === 'one_on_one') return capacity === 1;
	if (pref === 'small') return capacity <= SMALL_GROUP_MAX;
	return true;
}

// ---------------- tutors ----------------

export interface TutorCandidate {
	id: string;
	teachingMode: TeachingMode;
	timeZone: string;
	availability: readonly WeeklyWindow[];
	/** Which of the student's topics this tutor teaches. */
	coveredTopicIds: readonly string[];
}

export interface RankedTutor<T extends TutorCandidate> {
	tutor: T;
	/** Shared free time, in the student's local time. */
	overlaps: WeeklyWindow[];
	overlapMinutes: number;
}

/**
 * Tutors who teach at least one of the student's topics, in a way that suits them, with some
 * shared weekly time. Best coverage first, then most shared time.
 * Tutor windows are shifted into the student's timezone using the offsets at `now`.
 */
export function rankTutors<T extends TutorCandidate>(
	student: StudentMatchContext,
	candidates: readonly T[],
	now: Date = new Date()
): RankedTutor<T>[] {
	const wanted = new Set(student.topicIds);
	const studentOffset = timeZoneOffsetMinutes(student.timeZone, now);
	const ranked: RankedTutor<T>[] = [];

	for (const tutor of candidates) {
		if (!tutor.coveredTopicIds.some((id) => wanted.has(id))) continue;
		if (!tutorDeliveryFits(student.deliveryPreference, tutor.teachingMode)) continue;

		const delta = studentOffset - timeZoneOffsetMinutes(tutor.timeZone, now);
		const overlaps = intersectWindows(
			student.availability,
			shiftWindows(tutor.availability, delta)
		);
		if (overlaps.length === 0) continue;

		ranked.push({ tutor, overlaps, overlapMinutes: totalWindowMinutes(overlaps) });
	}

	const covered = (r: RankedTutor<T>) =>
		r.tutor.coveredTopicIds.filter((id) => wanted.has(id)).length;
	return ranked.sort((a, b) => covered(b) - covered(a) || b.overlapMinutes - a.overlapMinutes);
}

// ---------------- open sessions ----------------

export interface SessionCandidate {
	id: string;
	topicId: string;
	startsAt: Date;
	durationMinutes: number;
	capacity: number;
	/** Seats held: confirmed bookings + unexpired pending ones. */
	seatsTaken: number;
	locationType: SessionLocationType;
}

/**
 * Can anyone still join this session? Not private / at a student's home (D6), not locked yet
 * (D1), and a seat left. Says nothing about whether it suits a particular student.
 * Inputs come from OpenSessions.list, which only returns scheduled, open-visibility sessions.
 */
export function isOpenForJoining(
	s: Pick<SessionCandidate, 'locationType' | 'startsAt' | 'seatsTaken' | 'capacity'>,
	now: Date = new Date()
): boolean {
	return isJoinable({ ...s, status: 'scheduled', visibility: 'open' }, null, now);
}

/**
 * Open sessions the student could join: on one of their topics, not locked yet (D1), with a
 * seat left, a format and group size they want, and starting inside their free time.
 * Soonest first.
 */
export function filterJoinableSessions<S extends SessionCandidate>(
	student: StudentMatchContext,
	sessions: readonly S[],
	now: Date = new Date()
): S[] {
	const wanted = new Set(student.topicIds);

	return sessions
		.filter((s) => {
			if (!wanted.has(s.topicId)) return false;
			if (!isOpenForJoining(s, now)) return false;
			if (!sessionDeliveryFits(student.deliveryPreference, s.locationType)) return false;
			if (!groupFits(student.groupPreference, s.capacity)) return false;
			const { day, minute } = localWeekdayMinute(s.startsAt, student.timeZone);
			return isWithinWindows(student.availability, day, minute, s.durationMinutes);
		})
		.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
