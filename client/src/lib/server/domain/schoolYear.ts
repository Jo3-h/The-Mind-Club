// Students store the year they finish Year 12, not their year level, because year level
// goes stale every January (see db/schema/student-profiles.ts).

/** The calendar year a student in `yearLevel` finishes Year 12. */
export function graduationYearFor(yearLevel: number, schoolYear: number): number {
	if (!Number.isInteger(yearLevel) || yearLevel < 1 || yearLevel > 12) {
		throw new RangeError(`yearLevel (${yearLevel}) must be a whole number from 1 to 12`);
	}
	return schoolYear + (12 - yearLevel);
}

/** The inverse: what year level a student is in during `schoolYear`. */
export function yearLevelFor(graduationYear: number, schoolYear: number): number {
	return 12 - (graduationYear - schoolYear);
}

/** The Australian school year is the calendar year, taken in the given timezone. */
export function currentSchoolYear(timeZone: string, now: Date = new Date()): number {
	return Number(new Intl.DateTimeFormat('en-AU', { timeZone, year: 'numeric' }).format(now));
}
