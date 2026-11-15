import { eq } from 'drizzle-orm';
import { db, type Executor } from '../db';
import { tutorProfiles } from '../db/schema/tutor-profiles';
import type { AuState, TeachingMode } from '$lib/constants/profile';

export type TutorProfileRow = typeof tutorProfiles.$inferSelect;

export type TutorOnboardingProfile = {
	headline: string;
	bio: string;
	state: AuState;
	timezone: string;
	teachingMode: TeachingMode;
	postcode: string | null;
	travelRadiusKm: number | null;
	maxGroupSize: number;
	/** 1 student × 60 min, integer cents. */
	baseRateCents: number;
	wwccNumber: string | null;
};

export const Tutor = {
	async getProfile(params: { userId: string; tx?: Executor }) {
		const { userId, tx = db } = params;
		const [row] = await tx
			.select()
			.from(tutorProfiles)
			.where(eq(tutorProfiles.userId, userId))
			.limit(1);
		return row;
	},

	/**
	 * Creates the profile, or fills in an existing one, and marks onboarding complete.
	 * Status becomes 'active'; bookability still also needs Stripe payouts and a verified WWCC
	 * (see tutor-profiles.ts), which this doesn't touch.
	 */
	async upsertOnboarding(params: {
		userId: string;
		profile: TutorOnboardingProfile;
		tx?: Executor;
	}) {
		const { userId, profile, tx = db } = params;
		const values = {
			...profile,
			// a number entered here is unverified until an admin checks it
			wwccState: profile.wwccNumber ? profile.state : null,
			wwccStatus: profile.wwccNumber ? ('pending' as const) : ('not_provided' as const),
			status: 'active' as const,
			onboardingCompletedAt: new Date(),
			updatedAt: new Date()
		};
		const [row] = await tx
			.insert(tutorProfiles)
			.values({ userId, ...values })
			.onConflictDoUpdate({ target: tutorProfiles.userId, set: values })
			.returning();
		return row;
	},

	/** The tutor's standing online room. Validate with MeetingUrlSchema first; null clears it. */
	async setMeetingUrl(params: { userId: string; meetingUrl: string | null; tx?: Executor }) {
		const { userId, meetingUrl, tx = db } = params;
		await tx
			.update(tutorProfiles)
			.set({ meetingUrl, updatedAt: new Date() })
			.where(eq(tutorProfiles.userId, userId));
	}
};
