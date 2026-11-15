import { ADMIN_ACCOUNT_TYPE } from '$lib/constants/profile';
import type { AuthUser } from '../auth';

export function checkIsAdmin(params: { user: AuthUser }) {
	const { user } = params;

	return user.role === ADMIN_ACCOUNT_TYPE;
}
