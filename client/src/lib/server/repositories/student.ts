import { eq } from 'drizzle-orm';
import { db, type Executor } from '../db';
import { studentProfiles } from '../db/schema/student-profiles';
import type { AuState } from '$lib/constants/profile';
import type { DeliveryPreference, GroupPreference } from '../domain/matching';

export type StudentProfileRow = typeof studentProfiles.$inferSelect;

export type StudentOnboardingProfile = {
	state: AuState;
	timezone: string;
	postcode: string | null;
	school: string | null;
	graduationYear: number;
	deliveryPreference: DeliveryPreference;
	groupPreference: GroupPreference;
};

export const Student = {
	async getProfile(params: { userId: string; tx?: Executor }) {
		const { userId, tx = db } = params;
		const [row] = await tx
			.select()
			.from(studentProfiles)
			.where(eq(studentProfiles.userId, userId))
			.limit(1);
		return row;
	},

	/** Creates the profile, or fills in an existing one, and marks onboarding complete. */
	async upsertOnboarding(params: {
		userId: string;
		profile: StudentOnboardingProfile;
		tx?: Executor;
	}) {
		const { userId, profile, tx = db } = params;
		const values = { ...profile, onboardingCompletedAt: new Date(), updatedAt: new Date() };
		const [row] = await tx
			.insert(studentProfiles)
			.values({ userId, ...values })
			.onConflictDoUpdate({ target: studentProfiles.userId, set: values })
			.returning();
		return row;
	}
};
