import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	console.log('loading a protected route');
	if (!locals.user) {
		throw redirect(303, '/login');
	}
};
