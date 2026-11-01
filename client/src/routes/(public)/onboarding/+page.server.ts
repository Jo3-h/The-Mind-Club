import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { User } from '$lib/server/repositories/user.js';
import { Student } from '$lib/server/repositories/student.js';
import { Tutor } from '$lib/server/repositories/tutor.js';
import { OnboardingSchema } from '$lib/schemas/auth/onboarding.js';

export const load = async ({ locals }) => {
	if (!locals.user) redirect(303, '/login');
	if (await User.hasProfile({ userId: locals.user.id })) redirect(303, '/');
	return { firstName: locals.user.name?.split(' ')[0] ?? null };
};

export const actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) redirect(303, '/login');
		const userId = locals.user.id;
		const raw = Object.fromEntries(await request.formData());

		const parsed = OnboardingSchema.safeParse(raw);
		if (!parsed.success) {
			const fieldErrors: Record<string, string> = {};
			for (const issue of parsed.error.issues) {
				const key = String(issue.path[0] ?? 'form');
				fieldErrors[key] ??= issue.message;
			}
			// send values back so the form doesn't wipe what they typed
			return fail(400, { fieldErrors, values: raw as Record<string, string> });
		}

		// load() doesn't guard a direct POST, so check again here
		if (await User.hasProfile({ userId })) redirect(303, '/');

		const data = parsed.data;
		await db.transaction(async (tx) => {
			await User.setRole({ userId, role: data.accountType }, tx);

			if (data.accountType === 'student') {
				await Student.completeOnboarding(
					{
						userId,
						yearLevel: data.yearLevel,
						state: data.state,
						postcode: data.postcode,
						school: data.school
					},
					tx
				);
			} else {
				await Tutor.completeOnboarding(
					{
						userId,
						bio: data.bio,
						teachingMode: data.teachingMode,
						state: data.state,
						postcode: data.postcode
					},
					tx
				);
			}
		});

		redirect(303, '/');
	}
};
