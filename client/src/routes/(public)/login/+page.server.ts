import { fail, redirect, type Actions } from '@sveltejs/kit';
import { APIError } from 'better-auth';
import * as z from 'zod';
import type { PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { LoginSchema } from '$lib/schemas/auth/auth';
import {
	DEFAULT_AFTER_LOGIN,
	SafeRedirectSchema,
	safeRedirectPath
} from '$lib/schemas/auth/redirect';
import { formToObject } from '$lib/utils/forms';

export const load: PageServerLoad = ({ locals, url }) => {
	// ?redirectTo= is set by the protected layout so people land back where they were going
	const redirectTo = SafeRedirectSchema.parse(url.searchParams.get('redirectTo') ?? undefined);
	if (locals.user) redirect(302, redirectTo ?? DEFAULT_AFTER_LOGIN);
	return { redirectTo: redirectTo ?? null };
};

export const actions: Actions = {
	signInEmail: async ({ request }) => {
		const parsed = LoginSchema.safeParse(formToObject(await request.formData()));
		if (!parsed.success) {
			return fail(400, { message: z.prettifyError(parsed.error) });
		}
		const { email, password, redirectTo } = parsed.data;
		try {
			await auth.api.signInEmail({
				body: {
					email,
					password,
					callbackURL: '/auth/verification-success'
				}
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Signin failed' });
			}
			return fail(500, { message: 'Unexpected error' });
		}
		// default: onboarding, which forwards anyone already set up to /account
		redirect(302, safeRedirectPath(redirectTo));
	}
};
