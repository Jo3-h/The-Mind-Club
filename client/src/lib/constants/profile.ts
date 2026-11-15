import type { Constraint } from './shared';

export const STATES = ['SA', 'NSW', 'VIC', 'QLD', 'WA', 'TAS', 'ACT', 'NT'] as const;
export type AuState = (typeof STATES)[number];

export const YEAR_LEVELS = [7, 8, 9, 10, 11, 12] as const;
export const YEAR_LEVEL_CONSTRAINT: Constraint = {
	MIN: Math.min(...YEAR_LEVELS),
	MAX: Math.max(...YEAR_LEVELS),
	STEP: 1
};

export const TEACHING_MODES = ['online', 'in_person', 'both'] as const;
export type TeachingMode = (typeof TEACHING_MODES)[number];

export const TEACHING_MODE_LABELS: Record<TeachingMode, string> = {
	online: 'Online',
	in_person: 'In person',
	both: 'Both'
};

/** Australian postcodes are exactly 4 digits, kept as text so leading zeros (e.g. 0800) survive. */
/** Used when a user's timezone is unknown (and in dev). */
export const DEFAULT_TIME_ZONE = 'Australia/Adelaide';

export const POSTCODE_DIGITS = 4;
export const POSTCODE_PATTERN = new RegExp(`^\\d{${POSTCODE_DIGITS}}$`);

export const TUTOR_ACCOUNT_TYPE = 'tutor';
export const STUDENT_ACCOUNT_TYPE = 'student';
export const ADMIN_ACCOUNT_TYPE = 'admin';
export const ACCOUNT_TYPES = [
	TUTOR_ACCOUNT_TYPE,
	STUDENT_ACCOUNT_TYPE,
	ADMIN_ACCOUNT_TYPE
] as const;
