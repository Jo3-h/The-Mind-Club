import type { User } from 'better-auth';
import { db } from '$lib/server/db';
import type { Transaction } from '../types/db';
import { tutorProfiles } from '../db/schema';

export async function createDefaultTutor(params: { user: Pick<User, 'id'>; trx?: Transaction }) {
	const { user, trx } = params;

	const run = async (tx: Transaction) => {
		const [profile] = await tx.insert(tutorProfiles).values({
			userId: user.id,
			isActive: true
		});
	};

	if (trx) return run(trx);
	return db.transaction(run);
}
