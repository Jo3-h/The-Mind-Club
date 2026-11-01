import { db } from '$lib/server/db';
import { user } from '$lib/server/db/auth-schema.js';
import { eq, or } from 'drizzle-orm';
import { studentProfiles, tutorProfiles } from '../db/schema';
import type { Transaction } from '../types/db';

export const User = {
	async hasProfile({ userId }: { userId: string }, tx: Transaction | null = null) {
		const conn = tx ?? db;
		const [student] = await conn
			.select({ id: studentProfiles.id })
			.from(studentProfiles)
			.where(eq(studentProfiles.userId, userId))
			.limit(1);
		if (student) return true;

		const [tutor] = await conn
			.select({ id: tutorProfiles.id })
			.from(tutorProfiles)
			.where(eq(tutorProfiles.userId, userId))
			.limit(1);
		return Boolean(tutor);
	},
	async setRole(
		{ userId, role }: { userId: string; role: 'student' | 'tutor' },
		tx: Transaction | null = null
	) {
		const conn = tx ?? db;
		await conn.update(user).set({ role }).where(eq(user.id, userId));
	}
};
