import type { User } from 'better-auth';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import type { Transaction } from '../types/db';
import { tutorProfiles } from '../db/schema';
import type { AuState, TeachingMode } from '$lib/constants/profile';

export const Tutor = {
	async createDefault(params: { user: Pick<User, 'id'>; trx?: Transaction }) {
		const { user, trx } = params;

		const run = async (tx: Transaction) => {
			const [profile] = await tx.insert(tutorProfiles).values({
				userId: user.id,
				isActive: true
			});
		};

		if (trx) return run(trx);
		return db.transaction(run);
	},

	async completeOnboarding(
		params: {
			userId: string;
			bio?: string;
			headline?: string;
			state: AuState;
			postcode: number;
			teachingMode: TeachingMode;
		},
		tx: Transaction | null = null
	) {
		const { userId, bio, state, postcode, teachingMode, headline } = params;
		const conn = tx ?? db;
		await conn
			.update(tutorProfiles)
			.set({ bio, state, postcode, teachingMode, headline })
			.where(eq(tutorProfiles.userId, userId));
	}
};
