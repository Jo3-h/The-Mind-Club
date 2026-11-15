import { db, type Executor } from '../db';
import type { OnboardingInput } from '$lib/schemas/auth/onboarding';
import { currentSchoolYear, graduationYearFor } from '../domain/schoolYear';
import { User } from './user';
import { Student } from './student';
import { Tutor } from './tutor';
import { Topic } from './topics';
import { StudentTopic } from './student-topics';
import { TutorTopic } from './tutor-topics';
import { Availability } from './availability';

export type CompleteOnboardingResult =
	{ ok: true; role: 'student' | 'tutor' } | { ok: false; field: 'topicIds'; message: string };

export const Onboarding = {
	/**
	 * Everything onboarding saves, in one transaction: role, profile (marked complete),
	 * chosen topics and weekly availability. Input must already be validated by OnboardingSchema.
	 */
	async complete(params: {
		userId: string;
		input: OnboardingInput;
		tx?: Executor;
	}): Promise<CompleteOnboardingResult> {
		const { userId, input, tx = db } = params;

		return tx.transaction(async (t) => {
			// ids come from the client: only keep real, active topics
			const topicIds = await Topic.filterActiveIds({ ids: input.topicIds, tx: t });
			if (topicIds.length !== input.topicIds.length) {
				return {
					ok: false,
					field: 'topicIds',
					message: 'Some chapters are no longer available. Please pick again.'
				} as const;
			}

			await User.setRole({ userId, role: input.accountType, tx: t });

			if (input.accountType === 'student') {
				await Student.upsertOnboarding({
					userId,
					profile: {
						state: input.state,
						timezone: input.timezone,
						postcode: input.postcode,
						school: input.school,
						graduationYear: graduationYearFor(input.yearLevel, currentSchoolYear(input.timezone)),
						deliveryPreference: input.deliveryPreference,
						groupPreference: input.groupPreference
					},
					tx: t
				});
				await StudentTopic.replace({ studentId: userId, topicIds, tx: t });
			} else {
				await Tutor.upsertOnboarding({
					userId,
					profile: {
						headline: input.headline,
						bio: input.bio,
						state: input.state,
						timezone: input.timezone,
						teachingMode: input.teachingMode,
						postcode: input.postcode,
						travelRadiusKm: input.travelRadiusKm,
						maxGroupSize: input.maxGroupSize,
						baseRateCents: input.baseRate,
						wwccNumber: input.wwccNumber
					},
					tx: t
				});
				await TutorTopic.replace({ tutorId: userId, topicIds, tx: t });
			}

			await Availability.replaceForUser({ userId, windows: input.availability, tx: t });
			return { ok: true, role: input.accountType } as const;
		});
	}
};
