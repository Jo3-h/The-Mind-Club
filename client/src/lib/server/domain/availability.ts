// Pure helpers for weekly availability windows.
//
// A window is local wall-clock time in the owner's IANA timezone:
//   { day: 1..7 (ISO, Mon = 1), start: minutes from midnight, end: exclusive }
// See db/schema/weekly-availability.ts for why these are not stored as UTC.

export interface WeeklyWindow {
	day: number;
	start: number;
	end: number;
}

export interface WindowRules {
	/** Earliest allowed start, in minutes from midnight. */
	min: number;
	/** Latest allowed end, in minutes from midnight. */
	max: number;
	/** Every start/end must be a multiple of this many minutes. */
	step: number;
}

const DAY_MINUTES = 24 * 60;
const WEEK_MINUTES = 7 * DAY_MINUTES;

export type NormaliseResult = { ok: true; windows: WeeklyWindow[] } | { ok: false; error: string };

/**
 * Validates raw windows and returns them sorted, with overlapping or touching
 * windows on the same day merged. Rejects anything outside `rules`.
 */
export function normaliseWindows(
	raw: readonly WeeklyWindow[],
	rules: WindowRules
): NormaliseResult {
	for (const w of raw) {
		if (![w.day, w.start, w.end].every(Number.isInteger)) {
			return { ok: false, error: 'Availability times must be whole minutes' };
		}
		if (w.day < 1 || w.day > 7) return { ok: false, error: 'Availability has an invalid day' };
		if (w.start < rules.min || w.end > rules.max) {
			return { ok: false, error: 'Availability is outside the allowed hours' };
		}
		if (w.end <= w.start)
			return { ok: false, error: 'Availability windows must end after they start' };
		if (w.start % rules.step !== 0 || w.end % rules.step !== 0) {
			return { ok: false, error: `Availability must be in ${rules.step}-minute steps` };
		}
	}

	const sorted = [...raw].sort((a, b) => a.day - b.day || a.start - b.start);
	const merged: WeeklyWindow[] = [];
	for (const w of sorted) {
		const last = merged.at(-1);
		if (last && last.day === w.day && w.start <= last.end) {
			last.end = Math.max(last.end, w.end);
		} else {
			merged.push({ ...w });
		}
	}
	return { ok: true, windows: merged };
}

/** Shared time between two sets of windows (both in the same timezone). */
export function intersectWindows(
	a: readonly WeeklyWindow[],
	b: readonly WeeklyWindow[]
): WeeklyWindow[] {
	const out: WeeklyWindow[] = [];
	for (const x of a) {
		for (const y of b) {
			if (x.day !== y.day) continue;
			const start = Math.max(x.start, y.start);
			const end = Math.min(x.end, y.end);
			if (end > start) out.push({ day: x.day, start, end });
		}
	}
	return out.sort((p, q) => p.day - q.day || p.start - q.start);
}

/**
 * Moves windows by `deltaMinutes` (e.g. to re-express a tutor's Sydney hours in Adelaide time).
 * Wraps around the week and splits windows that cross midnight.
 */
export function shiftWindows(
	windows: readonly WeeklyWindow[],
	deltaMinutes: number
): WeeklyWindow[] {
	if (deltaMinutes === 0) return windows.map((w) => ({ ...w }));
	const out: WeeklyWindow[] = [];
	for (const w of windows) {
		const length = w.end - w.start;
		let start =
			((((w.day - 1) * DAY_MINUTES + w.start + deltaMinutes) % WEEK_MINUTES) + WEEK_MINUTES) %
			WEEK_MINUTES;
		let remaining = length;
		while (remaining > 0) {
			const day = Math.floor(start / DAY_MINUTES) + 1;
			const startInDay = start % DAY_MINUTES;
			const end = Math.min(DAY_MINUTES, startInDay + remaining);
			out.push({ day, start: startInDay, end });
			remaining -= end - startInDay;
			start = (start + (end - startInDay)) % WEEK_MINUTES;
		}
	}
	return out.sort((p, q) => p.day - q.day || p.start - q.start);
}

/** Does [start, start + duration) on `day` sit entirely inside one window? */
export function isWithinWindows(
	windows: readonly WeeklyWindow[],
	day: number,
	start: number,
	durationMinutes: number
): boolean {
	const end = start + durationMinutes;
	return windows.some((w) => w.day === day && w.start <= start && w.end >= end);
}

export function totalWindowMinutes(windows: readonly WeeklyWindow[]): number {
	return windows.reduce((sum, w) => sum + (w.end - w.start), 0);
}

/** UTC offset of `timeZone` at `at`, in minutes (Adelaide in summer → +630). */
export function timeZoneOffsetMinutes(timeZone: string, at: Date): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric'
	}).formatToParts(at);
	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
	const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
	const atMinute = Math.floor(at.getTime() / 60000) * 60000;
	return Math.round((asUtc - atMinute) / 60000);
}

/** The ISO weekday and minute-of-day of an instant, in `timeZone`. */
export function localWeekdayMinute(at: Date, timeZone: string): { day: number; minute: number } {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		weekday: 'short',
		hour: 'numeric',
		minute: 'numeric'
	}).formatToParts(at);
	const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
	const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekday) + 1;
	const hour = Number(parts.find((p) => p.type === 'hour')?.value);
	const minute = Number(parts.find((p) => p.type === 'minute')?.value);
	return { day, minute: hour * 60 + minute };
}

/** True if `timeZone` is a valid IANA zone name. */
export function isValidTimeZone(timeZone: string): boolean {
	try {
		new Intl.DateTimeFormat('en-US', { timeZone });
		return true;
	} catch {
		return false;
	}
}

export interface LocalDate {
	year: number;
	/** 1–12 */
	month: number;
	day: number;
}

/** The calendar date, ISO weekday and minute-of-day of an instant, in `timeZone`. */
export function localDateParts(
	at: Date,
	timeZone: string
): LocalDate & { weekday: number; minute: number } {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric'
	}).formatToParts(at);
	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
	const date = { year: get('year'), month: get('month'), day: get('day') };
	return { ...date, weekday: isoWeekday(date), minute: get('hour') * 60 + get('minute') };
}

/** ISO weekday (Mon = 1 … Sun = 7) of a calendar date. */
export function isoWeekday(date: LocalDate): number {
	const sunday0 = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
	return sunday0 === 0 ? 7 : sunday0;
}

/** The calendar date `days` after `date` (no timezone involved: dates only). */
export function addDays(date: LocalDate, days: number): LocalDate {
	const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
	return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/**
 * The instant at wall-clock `minute` on `date` in `timeZone`, or null if that time doesn't
 * exist there (skipped by a daylight-saving jump). In the repeated hour when clocks go back,
 * returns the first of the two instants.
 */
export function zonedTimeToUtc(date: LocalDate, minute: number, timeZone: string): Date | null {
	const wall = Date.UTC(date.year, date.month - 1, date.day, 0, minute);
	// the offset at the wall time read as UTC is a guess; one refinement settles it
	let t = wall - timeZoneOffsetMinutes(timeZone, new Date(wall)) * 60000;
	t = wall - timeZoneOffsetMinutes(timeZone, new Date(t)) * 60000;
	// the earlier of the two candidates when the hour repeats
	const earlier = t - 60 * 60000;
	if (sameWallTime(new Date(earlier), date, minute, timeZone)) t = earlier;
	return sameWallTime(new Date(t), date, minute, timeZone) ? new Date(t) : null;
}

function sameWallTime(at: Date, date: LocalDate, minute: number, timeZone: string): boolean {
	const p = localDateParts(at, timeZone);
	return (
		p.year === date.year && p.month === date.month && p.day === date.day && p.minute === minute
	);
}
