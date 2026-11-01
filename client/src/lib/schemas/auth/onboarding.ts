import * as z from 'zod';
import { STUDENT_ACCOUNT_TYPE, TUTOR_ACCOUNT_TYPE } from './auth';
import { POSTCODE, STATES, TEACHING_MODES, YEAR_LEVELS } from '$lib/constants/profile';
import { ConstrainedNumberLike } from '../shared/schemas';

export const StudentOnboardingSchema = z.object({
	accountType: z.literal(STUDENT_ACCOUNT_TYPE),
	yearLevel: z.literal(YEAR_LEVELS),
	state: z.enum(STATES),
	postcode: ConstrainedNumberLike('postcode', POSTCODE),
	school: z.string()
});

export const TutorOnboardingSchema = z.object({
	accountType: z.literal(TUTOR_ACCOUNT_TYPE),
	bio: z
		.string()
		.trim()
		.min(20, 'Bio should be at least 20 characters')
		.max(200, 'Bio must be less than 200 characters')
		.optional(),
	state: z.enum(STATES),
	teachingMode: z.enum(TEACHING_MODES),
	postcode: ConstrainedNumberLike('postcode', POSTCODE)
});

export const OnboardingSchema = z.discriminatedUnion('accountType', [
	StudentOnboardingSchema,
	TutorOnboardingSchema
]);
