import type { User } from 'better-auth';
import type { Transaction } from '../types/db';

export async function createDefaultStudent(params: { user: Pick<User, 'id'>; trx?: Transaction }) {
	const { user, trx } = params;
	console.log('Student account requires no additional logic.');
	return;
}
