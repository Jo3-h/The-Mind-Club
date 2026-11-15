import { describe, expect, it } from 'vitest';
import { OnboardingSchema, onboardingFormToObject } from './onboarding';
import { TUTOR_HOURLY_RATE_CENTS } from '$lib/constants/pricing';

const TOPIC_A = '0b6f1a52-7d8c-4c6e-9a51-2f3c1e0d9b11';
const TOPIC_B = '4a1e2b3c-5d6e-4f70-8a91-b2c3d4e5f607';
const AVAILABILITY = JSON.stringify([
	{ day: 2, start: 960, end: 1020 },
	{ day: 2, start: 1020, end: 1080 }
]);

function form(fields: Record<string, string | string[]>) {
	const fd = new FormData();
	for (const [k, v] of Object.entries(fields)) {
		for (const item of Array.isArray(v) ? v : [v]) fd.append(k, item);
	}
	return onboardingFormToObject(fd);
}

const student = {
	accountType: 'student',
	yearLevel: '10',
	state: 'SA',
	school: '',
	topicIds: [TOPIC_A, TOPIC_B, TOPIC_A],
	availability: AVAILABILITY,
	deliveryPreference: 'online',
	groupPreference: 'any',
	timezone: 'Australia/Adelaide'
};

const tutor = {
	accountType: 'tutor',
	headline: 'Maths tutor',
	bio: 'I teach maths.',
	state: 'SA',
	wwccNumber: '',
	topicIds: [TOPIC_A],
	maxGroupSize: '4',
	baseRate: '70',
	teachingMode: 'online',
	availability: AVAILABILITY,
	timezone: 'Australia/Adelaide'
};

function errorsFor(fields: Record<string, string | string[]>) {
	const result = OnboardingSchema.safeParse(form(fields));
	expect(result.success).toBe(false);
	return result.success ? [] : result.error.issues.map((i) => String(i.path[0]));
}

describe('student onboarding', () => {
	it('parses a valid online student', () => {
		const result = OnboardingSchema.safeParse(form(student));
		expect(result.success).toBe(true);
		if (!result.success || result.data.accountType !== 'student') return;
		expect(result.data.yearLevel).toBe(10);
		expect(result.data.school).toBeNull();
		expect(result.data.postcode).toBeNull();
		// every repeated topicIds value is kept, de-duplicated
		expect(result.data.topicIds).toEqual([TOPIC_A, TOPIC_B]);
		// touching windows are merged
		expect(result.data.availability).toEqual([{ day: 2, start: 960, end: 1080 }]);
	});

	it('requires a postcode for in-person, but not online', () => {
		expect(errorsFor({ ...student, deliveryPreference: 'either' })).toContain('postcode');
		const ok = OnboardingSchema.safeParse(
			form({ ...student, deliveryPreference: 'in_person', postcode: '0800' })
		);
		expect(ok.success && ok.data.accountType === 'student' && ok.data.postcode).toBe('0800');
	});

	it('drops a postcode sent by an online student', () => {
		const result = OnboardingSchema.safeParse(form({ ...student, postcode: '5000' }));
		expect(result.success && result.data.postcode).toBeNull();
	});

	it('rejects bad year levels, missing topics and empty availability', () => {
		expect(errorsFor({ ...student, yearLevel: '13' })).toContain('yearLevel');
		expect(errorsFor({ ...student, topicIds: [] })).toContain('topicIds');
		expect(errorsFor({ ...student, availability: '[]' })).toContain('availability');
		expect(errorsFor({ ...student, availability: 'not json' })).toContain('availability');
	});

	it('falls back to Adelaide for an unknown timezone', () => {
		const result = OnboardingSchema.safeParse(form({ ...student, timezone: 'Nope/Zone' }));
		expect(result.success && result.data.timezone).toBe('Australia/Adelaide');
	});
});

describe('tutor onboarding', () => {
	it('parses a valid online tutor and clears location', () => {
		const result = OnboardingSchema.safeParse(
			form({ ...tutor, postcode: '5000', travelRadiusKm: '10' })
		);
		expect(result.success).toBe(true);
		if (!result.success || result.data.accountType !== 'tutor') return;
		expect(result.data.maxGroupSize).toBe(4);
		expect(result.data.wwccNumber).toBeNull();
		expect(result.data.postcode).toBeNull();
		expect(result.data.travelRadiusKm).toBeNull();
	});

	it('requires postcode and travel radius when teaching in person', () => {
		const errors = errorsFor({ ...tutor, teachingMode: 'both' });
		expect(errors).toEqual(expect.arrayContaining(['postcode', 'travelRadiusKm']));
		const ok = OnboardingSchema.safeParse(
			form({ ...tutor, teachingMode: 'in_person', postcode: '5000', travelRadiusKm: '15' })
		);
		expect(ok.success && ok.data.accountType === 'tutor' && ok.data.travelRadiusKm).toBe(15);
	});

	it('converts the hourly rate to cents and enforces the range', () => {
		const ok = OnboardingSchema.safeParse(form({ ...tutor, baseRate: '65.50' }));
		expect(ok.success && ok.data.accountType === 'tutor' && ok.data.baseRate).toBe(6550);
		const atMin = OnboardingSchema.safeParse(
			form({ ...tutor, baseRate: String(TUTOR_HOURLY_RATE_CENTS.MIN / 100) })
		);
		expect(atMin.success).toBe(true);
		expect(
			errorsFor({ ...tutor, baseRate: String(TUTOR_HOURLY_RATE_CENTS.MIN / 100 - 1) })
		).toContain('baseRate');
		expect(
			errorsFor({ ...tutor, baseRate: String(TUTOR_HOURLY_RATE_CENTS.MAX / 100 + 1) })
		).toContain('baseRate');
		expect(errorsFor({ ...tutor, baseRate: '70.123' })).toContain('baseRate');
		expect(errorsFor({ ...tutor, baseRate: '' })).toContain('baseRate');
	});

	it('rejects missing headline/bio, bad group size and unknown radius', () => {
		expect(errorsFor({ ...tutor, headline: '  ' })).toContain('headline');
		expect(errorsFor({ ...tutor, bio: '' })).toContain('bio');
		expect(errorsFor({ ...tutor, maxGroupSize: '9' })).toContain('maxGroupSize');
		expect(
			errorsFor({ ...tutor, teachingMode: 'both', postcode: '5000', travelRadiusKm: '7' })
		).toContain('travelRadiusKm');
	});
});

it('rejects a missing account type', () => {
	const rest: Record<string, string | string[]> = { ...student };
	delete rest.accountType;
	expect(OnboardingSchema.safeParse(form(rest)).success).toBe(false);
});
