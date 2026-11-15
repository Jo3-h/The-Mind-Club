import { describe, expect, it } from 'vitest';
import { currentSchoolYear, graduationYearFor, yearLevelFor } from './schoolYear';

describe('graduationYearFor', () => {
	it('converts a year level to the year they finish Year 12', () => {
		expect(graduationYearFor(12, 2026)).toBe(2026);
		expect(graduationYearFor(10, 2026)).toBe(2028);
		expect(graduationYearFor(7, 2026)).toBe(2031);
	});
	it('rejects invalid year levels', () => {
		expect(() => graduationYearFor(0, 2026)).toThrow(RangeError);
		expect(() => graduationYearFor(13, 2026)).toThrow(RangeError);
		expect(() => graduationYearFor(10.5, 2026)).toThrow(RangeError);
	});
	it('round-trips with yearLevelFor', () => {
		expect(yearLevelFor(graduationYearFor(9, 2026), 2026)).toBe(9);
		// a year later they are a year level higher
		expect(yearLevelFor(graduationYearFor(9, 2026), 2027)).toBe(10);
	});
});

describe('currentSchoolYear', () => {
	it('uses the local calendar year, not UTC', () => {
		// 31 Dec 2026 14:00Z is already 1 Jan 2027 in Adelaide
		const nye = new Date('2026-12-31T14:00:00Z');
		expect(currentSchoolYear('Australia/Adelaide', nye)).toBe(2027);
		expect(currentSchoolYear('UTC', nye)).toBe(2026);
	});
});
