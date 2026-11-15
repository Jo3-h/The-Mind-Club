// Pure rules for creating a session: when it can start, where it can happen, and its shape.
// The booking transaction (repositories/session-booking.ts) re-runs these on fresh data.

import {
	addDays,
	isoWeekday,
	localDateParts,
	zonedTimeToUtc,
	type WeeklyWindow
} from './availability';
import { distanceKm, type LatLng } from './geo';
import type { LocationType, SessionVisibility } from './joinability';
import { lockTimeFor } from './sessionLifecycle';
import {
	BOOKING_HORIZON_DAYS,
	GROUP_SIZE,
	SESSION_DURATIONS,
	START_TIME_STEP_MINUTES
} from '../../constants/sessions';

export type TeachingMode = 'online' | 'in_person' | 'both';

export interface TimeRange {
	startsAt: Date;
	endsAt: Date;
}

export interface StartOption {
	startsAt: Date;
	/** Which of SESSION_DURATIONS fit from this start, shortest first. */
	durations: number[];
}

const MINUTE_MS = 60_000;

export function overlaps(a: TimeRange, b: TimeRange): boolean {
	return a.startsAt.getTime() < b.endsAt.getTime() && b.startsAt.getTime() < a.endsAt.getTime();
}

/**
 * Every start time a student can book with a tutor, with the lengths that fit.
 *
 * Walks each calendar day of the horizon in the TUTOR's timezone, turning their weekly windows
 * into real instants (so daylight-saving changes land correctly), on a START_TIME_STEP grid.
 * A start is offered when the whole session fits inside one window, it doesn't overlap the
 * tutor's existing sessions, it is far enough out to still be open (after the lock, D1) and it
 * is inside the booking horizon.
 */
export function availableStarts(params: {
	windows: readonly WeeklyWindow[];
	timeZone: string;
	busy: readonly TimeRange[];
	now: Date;
	horizonDays?: number;
	durations?: readonly number[];
	stepMinutes?: number;
}): StartOption[] {
	const {
		windows,
		timeZone,
		busy,
		now,
		horizonDays = BOOKING_HORIZON_DAYS,
		durations = SESSION_DURATIONS,
		stepMinutes = START_TIME_STEP_MINUTES
	} = params;
	const latest = now.getTime() + horizonDays * 24 * 60 * MINUTE_MS;
	const today = localDateParts(now, timeZone);
	const sortedDurations = [...durations].sort((a, b) => a - b);
	const out: StartOption[] = [];

	for (let i = 0; i <= horizonDays; i++) {
		const date = addDays(today, i);
		const weekday = isoWeekday(date);
		for (const w of windows) {
			if (w.day !== weekday) continue;
			const first = Math.ceil(w.start / stepMinutes) * stepMinutes;
			for (let minute = first; minute + sortedDurations[0] <= w.end; minute += stepMinutes) {
				const startsAt = zonedTimeToUtc(date, minute, timeZone);
				if (!startsAt) continue; // skipped by a daylight-saving jump
				if (lockTimeFor(startsAt).getTime() <= now.getTime()) continue;
				if (startsAt.getTime() > latest) continue;

				const fits = sortedDurations.filter((d) => {
					if (minute + d > w.end) return false;
					const range = { startsAt, endsAt: new Date(startsAt.getTime() + d * MINUTE_MS) };
					return !busy.some((b) => overlaps(range, b));
				});
				if (fits.length > 0) out.push({ startsAt, durations: fits });
			}
		}
	}
	return out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Is this exact start and length on offer? (Used to re-check a submitted booking.) */
export function isStartAvailable(
	options: readonly StartOption[],
	startsAt: Date,
	durationMinutes: number
): boolean {
	return options.some(
		(o) => o.startsAt.getTime() === startsAt.getTime() && o.durations.includes(durationMinutes)
	);
}

// ---------------- where ----------------

const IN_PERSON: LocationType[] = ['tutor_venue', 'public_venue', 'student_home'];

/** The places a session with this tutor can happen. */
export function locationOptions(mode: TeachingMode): LocationType[] {
	if (mode === 'online') return ['online'];
	if (mode === 'in_person') return [...IN_PERSON];
	return ['online', ...IN_PERSON];
}

export type TravelCheck = 'ok' | 'too_far' | 'unknown';

/**
 * Can the tutor travel to `place`? Only for venues away from the tutor's own place.
 * 'unknown' when either location can't be placed (postcode not in our table yet): callers
 * decide whether that's allowed.
 */
export function travelCheck(params: {
	tutorLocation: LatLng | null;
	travelRadiusKm: number | null;
	place: LatLng | null;
}): TravelCheck {
	const { tutorLocation, travelRadiusKm, place } = params;
	if (!tutorLocation || !place || travelRadiusKm === null) return 'unknown';
	return distanceKm(tutorLocation, place) <= travelRadiusKm ? 'ok' : 'too_far';
}

// ---------------- group ----------------

/** Largest group a student can set up with this tutor. */
export function maxBookableGroupSize(tutorMaxGroupSize: number): number {
	return Math.max(GROUP_SIZE.MIN, Math.min(tutorMaxGroupSize, GROUP_SIZE.MAX));
}

/**
 * Capacity and visibility for a new session. A group of 1 is a private 1:1; a session at a
 * student's home is always a private 1:1 (D6). Anything else is open for others to join.
 */
export function sessionShape(params: { locationType: LocationType; groupSize: number }): {
	capacity: number;
	visibility: SessionVisibility;
} {
	if (params.locationType === 'student_home') return { capacity: 1, visibility: 'private' };
	return {
		capacity: params.groupSize,
		visibility: params.groupSize > 1 ? 'open' : 'private'
	};
}
