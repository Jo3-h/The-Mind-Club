import { Topic } from '$lib/server/repositories/topics';
import { Subject } from '$lib/server/repositories/subjects';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { checkIsAdmin } from '$lib/server/auth/checks';
import {
	CreateTopicFormSchema,
	DeleteTopicFormSchema,
	UpdateTopicFormSchema
} from '$lib/schemas/forms/topics';
import { formToObject } from '$lib/utils/forms';
import z from 'zod';

export const load: PageServerLoad = async () => {
	const [topicList, subjects] = await Promise.all([Topic.list(), Subject.list()]);
	const topics = topicList.map((t) => {
		const subject = subjects.find((s) => s.id === t.topic.subjectId);
		return {
			topic: {
				...t.topic,
				subjectName: subject?.name ?? 'Unknown'
			},
			courseCount: t.courseCount
		};
	});
	return {
		topics,
		subjects
	};
};

async function checkUserGetResources(params: { locals: App.Locals; request: Request }) {
	const { locals, request } = params;
	if (!locals.user) error(401, 'Unauthenticated');
	if (!checkIsAdmin({ user: locals.user })) error(403, 'Forbidden');
	const fd = await request.formData();
	return fd;
}

export const actions: Actions = {
	updateTopic: async ({ locals, request }) => {
		const fd = await checkUserGetResources({ locals, request });
		const parsed = UpdateTopicFormSchema.safeParse(formToObject(fd));
		if (!parsed.success) {
			return fail(400, { message: z.prettifyError(parsed.error) });
		}
		const { id, ...input } = parsed.data;
		try {
			const row = await Topic.update({ id, input });
			if (!row) return fail(404, { message: 'This topic no longer exists' });
		} catch (err) {
			console.error('Error updating topic', { err });
			return fail(500, { message: 'Unknown error' });
		}
		return { ok: true };
	},
	deleteTopic: async ({ locals, request }) => {
		const fd = await checkUserGetResources({ locals, request });
		const parsed = DeleteTopicFormSchema.safeParse(formToObject(fd));
		if (!parsed.success) {
			return fail(400, { message: z.prettifyError(parsed.error) });
		}
		const { id } = parsed.data;
		try {
			const result = await Topic.delete({ id });
			if (!result.ok) {
				if (result.reason === 'not_found') {
					return fail(404, { message: 'This topic no longer exists' });
				}
				return fail(409, {
					message: `Cannot delete this topic: it's used by ${result.courseCount} course(s). Remove it from those courses first`
				});
			}
		} catch (err) {
			console.error('Error deleting topic', { err });
			return fail(500, { message: 'Unknown error' });
		}
		return { ok: true };
	},
	createTopic: async ({ locals, request }) => {
		const fd = await checkUserGetResources({ locals, request });
		const parsed = CreateTopicFormSchema.safeParse(formToObject(fd));
		if (!parsed.success) {
			return fail(400, { message: z.prettifyError(parsed.error) });
		}
		try {
			await Topic.create({ input: parsed.data });
		} catch (err) {
			console.error('Error creating topic', { err });
			return fail(500, { message: 'Unknown error' });
		}
		return { ok: true };
	}
};
