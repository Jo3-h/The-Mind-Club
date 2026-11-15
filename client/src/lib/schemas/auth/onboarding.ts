import * as z from 'zod';
import {
	STATES,
	STUDENT_ACCOUNT_TYPE,
	TEACHING_MODES,
	TUTOR_ACCOUNT_TYPE,
	YEAR_LEVELS
} from '$lib/constants/profile';
import {
	BIO_LENGTH,
	GROUP_SIZE_MAX,
	GROUP_SIZE_MIN,
	HEADLINE_LENGTH,
	SCHOOL_LENGTH,
	TRAVEL_RADII,
	WWCC_NUMBER_LENGTH
} from '$lib/constants/onboarding';
import { TUTOR_HOURLY_RATE_CENTS } from '$lib/constants/pricing';
import { NumberLike } from '../primitives/number-like';
import { OptionalText, RequiredText } from '../primitives/text';
import { DollarsAsCents } from '../primitives/money';
import {
	AvailabilityJsonSchema,
	PostcodeSchema,
	TimeZoneSchema,
	TopicIdsSchema
} from '../primitives/profile';

/**
 * Validation for the single onboarding POST. The form sends strings, so numbers are coerced.
 * Fields the form only shows conditionally (postcode, travel radius) are optional here and
 * required by a refinement instead, with the error placed on the field.
 */

const StateSchema = z.enum(STATES, { error: 'Pick your state' });

export const StudentOnboardingSchema = z
	.object({
		accountType: z.literal(STUDENT_ACCOUNT_TYPE),
		yearLevel: NumberLike('Year level').pipe(
			z.literal(YEAR_LEVELS, { error: 'Pick your year level' })
		),
		state: StateSchema,
		school: OptionalText('School', SCHOOL_LENGTH),
		topicIds: TopicIdsSchema,
		availability: AvailabilityJsonSchema,
		deliveryPreference: z.enum(['online', 'in_person', 'either'], {
			error: 'Choose online, in person or either'
		}),
		groupPreference: z.enum(['any', 'small', 'one_on_one'], { error: 'Choose a group size' }),
		postcode: PostcodeSchema,
		timezone: TimeZoneSchema
	})
	.superRefine((d, ctx) => {
		if (d.deliveryPreference !== 'online' && !d.postcode) {
			ctx.addIssue({
				code: 'custom',
				path: ['postcode'],
				message: 'Enter your postcode for in-person sessions'
			});
		}
	})
	// online-only students don't need a stored postcode
	.transform((d) => ({ ...d, postcode: d.deliveryPreference === 'online' ? null : d.postcode }));

export const TutorOnboardingSchema = z
	.object({
		accountType: z.literal(TUTOR_ACCOUNT_TYPE),
		headline: RequiredText('Headline', HEADLINE_LENGTH),
		bio: RequiredText('Bio', BIO_LENGTH),
		state: StateSchema,
		wwccNumber: OptionalText('WWCC number', WWCC_NUMBER_LENGTH),
		topicIds: TopicIdsSchema,
		maxGroupSize: NumberLike('Group size').pipe(
			z
				.number()
				.int()
				.min(GROUP_SIZE_MIN, `Group size must be at least ${GROUP_SIZE_MIN}`)
				.max(GROUP_SIZE_MAX, `Group size must be at most ${GROUP_SIZE_MAX}`)
		),
		baseRate: DollarsAsCents('Hourly rate', TUTOR_HOURLY_RATE_CENTS),
		teachingMode: z.enum(TEACHING_MODES, { error: 'Choose how you teach' }),
		postcode: PostcodeSchema,
		travelRadiusKm: z
			.string()
			.optional()
			.transform((v) => (v ? Number(v) : null))
			.pipe(z.union([z.literal(TRAVEL_RADII), z.null()], { error: 'Pick a travel distance' })),
		availability: AvailabilityJsonSchema,
		timezone: TimeZoneSchema
	})
	.superRefine((d, ctx) => {
		if (d.teachingMode === 'online') return;
		if (!d.postcode) {
			ctx.addIssue({
				code: 'custom',
				path: ['postcode'],
				message: 'Enter your postcode for in-person sessions'
			});
		}
		if (d.travelRadiusKm === null) {
			ctx.addIssue({
				code: 'custom',
				path: ['travelRadiusKm'],
				message: 'Pick how far you will travel'
			});
		}
	})
	// online-only tutors don't need a stored location
	.transform((d) =>
		d.teachingMode === 'online' ? { ...d, postcode: null, travelRadiusKm: null } : d
	);

export const OnboardingSchema = z.discriminatedUnion(
	'accountType',
	[StudentOnboardingSchema, TutorOnboardingSchema],
	{ error: 'Choose student or tutor' }
);

export type StudentOnboardingInput = z.output<typeof StudentOnboardingSchema>;
export type TutorOnboardingInput = z.output<typeof TutorOnboardingSchema>;
export type OnboardingInput = z.output<typeof OnboardingSchema>;

/** FormData → the plain object the schema expects (topicIds is repeated, so use getAll). */
export function onboardingFormToObject(fd: FormData) {
	const obj: Record<string, unknown> = {};
	for (const [key, value] of fd.entries()) {
		if (typeof value === 'string' && key !== 'topicIds') obj[key] = value;
	}
	obj.topicIds = fd.getAll('topicIds').filter((v): v is string => typeof v === 'string');
	return obj;
}
