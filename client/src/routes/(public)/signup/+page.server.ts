import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth';
import * as z from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { SignupSchema } from '$lib/schemas/auth/auth';
import { formToObject } from '$lib/utils/forms';
import { auth } from '$lib/server/auth';

export const load: PageServerLoad = (event) => {
	if (event.locals.user) {
		redirect(302, '/onboarding');
	}
};

export const actions: Actions = {
	/**
	 * Creates the account only. Role and profile are chosen and saved in /onboarding,
	 * so email and Google sign-ups take the same path.
	 */
	signUp: async (event) => {
		const fd = formToObject(await event.request.formData());
		const parsed = SignupSchema.safeParse(fd);
		if (!parsed.success) {
			return fail(400, { message: z.prettifyError(parsed.error) });
		}
		const { email, password, name } = parsed.data;
		try {
			await auth.api.signUpEmail({ body: { email, password, name } });
		} catch (err) {
			if (err instanceof APIError) {
				return fail(400, { message: err.message || 'Could not create your account' });
			}
			console.error('Error completing sign up', { err });
			return fail(500, { message: 'Something went wrong. Please try again.' });
		}
		redirect(303, '/onboarding');
	}
};
