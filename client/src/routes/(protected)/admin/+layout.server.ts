import { checkIsAdmin } from '$lib/server/auth/checks';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from '../$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user || !checkIsAdmin) {
		throw redirect(303, '/');
	}
};
