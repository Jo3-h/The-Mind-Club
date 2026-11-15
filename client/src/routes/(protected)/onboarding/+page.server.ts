import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { ADMIN_ACCOUNT_TYPE } from '$lib/constants/profile';
import { OnboardingSchema, onboardingFormToObject } from '$lib/schemas/auth/onboarding';
import { Curriculum } from '$lib/server/repositories/curriculum';
import { Onboarding } from '$lib/server/repositories/onboarding';
import { User } from '$lib/server/repositories/user';
import type { OnboardingFormResult } from '$lib/types/onboarding';

/** Where a user goes once onboarding is behind them (no dashboard yet). */
const DONE_REDIRECT = '/account';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/login');
	// admins are set up by hand; onboarding would overwrite their role
	if (locals.user.role === ADMIN_ACCOUNT_TYPE) redirect(303, DONE_REDIRECT);
	if (await User.isOnboarded({ userId: locals.user.id })) redirect(303, DONE_REDIRECT);

	return {
		firstName: locals.user.name?.split(' ')[0] ?? null,
		curriculum: await Curriculum.listGroups()
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) redirect(303, '/login');
		if (locals.user.role === ADMIN_ACCOUNT_TYPE) redirect(303, DONE_REDIRECT);
		const userId = locals.user.id;

		// load() doesn't guard a direct POST, so check again here
		if (await User.isOnboarded({ userId })) redirect(303, DONE_REDIRECT);

		const raw = onboardingFormToObject(await request.formData());
		// sent back on failure so the form doesn't wipe what they entered
		const values = raw as OnboardingFormResult['values'];

		const parsed = OnboardingSchema.safeParse(raw);
		if (!parsed.success) {
			const fieldErrors: Record<string, string> = {};
			for (const issue of parsed.error.issues) {
				const key = String(issue.path[0] ?? 'form');
				fieldErrors[key] ??= issue.message;
			}
			return fail(400, { fieldErrors, values } satisfies OnboardingFormResult);
		}

		let role: 'student' | 'tutor';
		try {
			const result = await Onboarding.complete({ userId, input: parsed.data });
			if (!result.ok) {
				return fail(400, {
					fieldErrors: { [result.field]: result.message },
					values
				} satisfies OnboardingFormResult);
			}
			role = result.role;
		} catch (err) {
			console.error('Error completing onboarding', { userId, err });
			return fail(500, {
				fieldErrors: { form: 'Something went wrong saving your details. Please try again.' },
				values
			} satisfies OnboardingFormResult);
		}

		redirect(303, role === 'student' ? '/onboarding/matches' : DONE_REDIRECT);
	}
};
