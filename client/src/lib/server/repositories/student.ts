import type { User } from 'better-auth';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { studentProfiles } from '../db/schema';
import type { Transaction } from '../types/db';
import type { AuState } from '$lib/constants/profile';

export const Student = {
	async createDefault(params: { user: Pick<User, 'id'>; trx?: Transaction }) {
		const { user, trx } = params;
		console.log('Student account requires no additional logic.');
		return;
	},

	async completeOnboarding(
		params: {
			userId: string;
			yearLevel: number;
			state: AuState;
			postcode: number;
			school: string;
		},
		tx: Transaction | null = null
	) {
		const { userId, yearLevel, state, postcode, school } = params;
		const conn = tx ?? db;
		await conn
			.update(studentProfiles)
			.set({ yearLevel, state, postcode, school })
			.where(eq(studentProfiles.userId, userId));
	}
};
