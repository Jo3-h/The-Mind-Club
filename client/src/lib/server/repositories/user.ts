import { eq } from 'drizzle-orm';
import { db, type Executor } from '../db';
import { user } from '../db/auth-schema';
import { studentProfiles } from '../db/schema/student-profiles';
import { tutorProfiles } from '../db/schema/tutor-profiles';

export type OnboardingRole = 'student' | 'tutor';

export const User = {
	/**
	 * True once the user has finished onboarding as either role.
	 * A profile row alone isn't enough: only `onboarding_completed_at` counts.
	 */
	async isOnboarded(params: { userId: string; tx?: Executor }) {
		const { userId, tx = db } = params;
		const [[student], [tutor]] = await Promise.all([
			tx
				.select({ at: studentProfiles.onboardingCompletedAt })
				.from(studentProfiles)
				.where(eq(studentProfiles.userId, userId))
				.limit(1),
			tx
				.select({ at: tutorProfiles.onboardingCompletedAt })
				.from(tutorProfiles)
				.where(eq(tutorProfiles.userId, userId))
				.limit(1)
		]);
		return Boolean(student?.at || tutor?.at);
	},

	async setRole(params: { userId: string; role: OnboardingRole; tx?: Executor }) {
		const { userId, role, tx = db } = params;
		await tx.update(user).set({ role }).where(eq(user.id, userId));
	}
};
