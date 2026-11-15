import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { TUTOR_ACCOUNT_TYPE } from '$lib/constants/profile';
import { MeetingLinkFormSchema } from '$lib/schemas/forms/booking';
import { Tutor } from '$lib/server/repositories/tutor';
import { User } from '$lib/server/repositories/user';

export const load: PageServerLoad = async ({ locals }) => {
	// the (protected) layout guarantees a user
	const isOnboarded = locals.user ? await User.isOnboarded({ userId: locals.user.id }) : false;
	const meetingUrl =
		locals.user?.role === TUTOR_ACCOUNT_TYPE && isOnboarded
			? ((await Tutor.getProfile({ userId: locals.user.id }))?.meetingUrl ?? null)
			: null;
	return { isOnboarded, meetingUrl };
};

export const actions: Actions = {
	/** A tutor's standing online room, used for their online sessions. */
	setMeetingLink: async ({ request, locals }) => {
		if (locals.user?.role !== TUTOR_ACCOUNT_TYPE) {
			return fail(403, { meetingError: 'Only tutors have a meeting link.' });
		}
		const parsed = MeetingLinkFormSchema.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) {
			return fail(400, { meetingError: parsed.error.issues[0]?.message ?? 'Check the link.' });
		}
		await Tutor.setMeetingUrl({ userId: locals.user.id, meetingUrl: parsed.data.meetingUrl });
		return { meetingSaved: true };
	}
};
