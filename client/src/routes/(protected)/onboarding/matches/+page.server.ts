import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { STUDENT_ACCOUNT_TYPE } from '$lib/constants/profile';
import { Availability } from '$lib/server/repositories/availability';
import { Recommendations } from '$lib/server/repositories/recommendations';
import { Student } from '$lib/server/repositories/student';
import { StudentTopic } from '$lib/server/repositories/student-topics';

/** Only students who've finished onboarding have matches; everyone else is sent on. */
async function requireOnboardedStudent(locals: App.Locals) {
	if (!locals.user) redirect(303, '/login');
	if (locals.user.role !== STUDENT_ACCOUNT_TYPE) redirect(303, '/account');
	const profile = await Student.getProfile({ userId: locals.user.id });
	if (!profile?.onboardingCompletedAt) redirect(303, '/onboarding');
	return { user: locals.user, profile };
}

export const load: PageServerLoad = async ({ locals }) => {
	const { user, profile } = await requireOnboardedStudent(locals);

	const [topics, availability] = await Promise.all([
		StudentTopic.listForStudent({ studentId: user.id }),
		Availability.listForUser({ userId: user.id })
	]);

	const recommendations = await Recommendations.forStudent({
		studentId: user.id,
		student: {
			topicIds: topics.map((t) => t.id),
			availability,
			timeZone: profile.timezone,
			deliveryPreference: profile.deliveryPreference ?? 'either',
			groupPreference: profile.groupPreference
		},
		topicTitles: new Map(topics.map((t) => [t.id, t.title]))
	});

	return {
		firstName: user.name?.split(' ')[0] ?? null,
		topicCount: topics.length,
		timeZone: profile.timezone,
		alreadyNotified: topics.length > 0 && topics.every((t) => t.notifyRequestedAt !== null),
		recommendations
	};
};

export const actions: Actions = {
	notify: async ({ locals }) => {
		const { user } = await requireOnboardedStudent(locals);
		await StudentTopic.requestNotify({ studentId: user.id });
		return { notified: true };
	}
};
