import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/** Pure auth guard. Logged-out visitors go to login and come back here afterwards. */
export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		const back = url.pathname + url.search;
		redirect(303, `/login?redirectTo=${encodeURIComponent(back)}`);
	}
};
