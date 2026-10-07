import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as z from 'zod';
import { SignupSchema, STUDENT_ACCOUNT_TYPE, TUTOR_ACCOUNT_TYPE } from '$lib/schemas/auth';
import { formToObject } from '$lib/utils/forms';
import { auth } from '$lib/server/auth';
import { createDefaultTutor } from '$lib/server/repositories/tutor';
import { createDefaultStudent } from '$lib/server/repositories/student';

export const load: PageServerLoad = (event) => {
	if (event.locals.user) {
		redirect(302, '/');
	}
};

export const actions: Actions = {
	signUp: async (event) => {
		console.log('Signing up user');
		const formData = await event.request.formData();
		const fd = formToObject(formData);
		const parsed = SignupSchema.safeParse(fd);
		if (!parsed.success) {
			console.log('Could Not complete signup');
			error(402, 'Could not complete signup');
		}
		const { email, password, name, accountType } = parsed.data;
		console.log('signing up user with', parsed.data);
		try {
			const { user } = await auth.api.signUpEmail({
				body: {
					email,
					password,
					name,
					role: accountType
				}
			});
			if (accountType === STUDENT_ACCOUNT_TYPE) {
				await createDefaultStudent({ user });
			} else if (accountType === TUTOR_ACCOUNT_TYPE) {
				const profile = await createDefaultTutor({ user });
				console.log('profile', profile);
			}
		} catch (err) {
			console.error('Error completing signUp', err);
			error(500, 'Error in completing SignUp');
		}
		redirect(303, '/account');
	}
};
