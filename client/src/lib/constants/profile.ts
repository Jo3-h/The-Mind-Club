export const STATES = ['SA', 'NSW', 'VIC', 'QLD', 'WA', 'TAS', 'ACT', 'NT'] as const;
export type AuState = (typeof STATES)[number];

export const YEAR_LEVELS = [7, 8, 9, 10, 11, 12] as const;

export const TEACHING_MODES = ['online', 'in_person', 'both'] as const;
export type TeachingMode = (typeof TEACHING_MODES)[number];

export const TEACHING_MODE_LABELS: Record<TeachingMode, string> = {
	online: 'Online',
	in_person: 'In person',
	both: 'Both'
};

export const POSTCODE = Object.freeze({
	MIN: 0,
	MAX: 9999,
	STEP: 1
});
