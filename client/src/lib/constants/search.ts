import { DAYS, GRID_END, GRID_START } from './onboarding';

/**
 * Coarse time slots for the "When" filter, so people can search without painting a grid.
 * Minutes from local midnight, end exclusive, inside the availability grid (GRID_START–GRID_END).
 */
export const TIME_SLOTS = [
	{ key: 'early', label: 'Before school', short: 'Early', start: GRID_START, end: 9 * 60 },
	{ key: 'day', label: 'Daytime', short: 'Day', start: 9 * 60, end: 15 * 60 },
	{ key: 'after', label: 'After school', short: 'After', start: 15 * 60, end: 18 * 60 },
	{ key: 'evening', label: 'Evening', short: 'Eve', start: 18 * 60, end: GRID_END }
] as const;

export type TimeSlotKey = (typeof TIME_SLOTS)[number]['key'];

/** Every valid slot code, e.g. "2-after" = Tuesday after school. Day is ISO (1 = Monday). */
export const TIME_SLOT_CODES: readonly string[] = DAYS.flatMap((d) =>
	TIME_SLOTS.map((s) => `${d.value}-${s.key}`)
);

/** A tutor only matches a time filter if they share at least one session's worth of time. */
export const MIN_SHARED_MINUTES = 60;

export const SEARCH_PAGE_SIZE = 20;

/** URL value for "no filter" on fields a student's profile would otherwise pre-fill. */
export const ANY_FILTER = 'any';

export const SEARCH_MODES = ['either', 'online', 'in_person'] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];

export const SEARCH_MODE_LABELS: Record<SearchMode, string> = {
	either: 'Online or in person',
	online: 'Online',
	in_person: 'In person'
};
