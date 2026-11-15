import { Subject } from '$lib/server/repositories/subjects';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { checkIsAdmin } from '$lib/server/auth/checks';
import {
	CreateSubjectFormSchema,
	DeleteSubjectFormSchema,
	UpdateSubjectFormSchema
} from '$lib/schemas/forms/subjects';
import { formToObject } from '$lib/utils/forms';
import z from 'zod';

export const load: PageServerLoad = async () => {
	const subjects = await Subject.list({});
	return {
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
	updateSubject: async ({ locals, request }) => {
		const fd = await checkUserGetResources({ locals, request });
		const parsed = UpdateSubjectFormSchema.safeParse(formToObject(fd));
		if (!parsed.success) {
			return fail(400, { message: z.prettifyError(parsed.error) });
		}
		const { id, ...input } = parsed.data;
		try {
			await Subject.update({ id, input });
		} catch (err) {
			console.error('Error updating subject', { err });
			return fail(500, { message: 'Unknown error' });
		}

		return { ok: true };
	},
	deleteSubject: async ({ locals, request }) => {
		const fd = await checkUserGetResources({ locals, request });
		const parsed = DeleteSubjectFormSchema.safeParse(formToObject(fd));
		if (!parsed.success) {
			return fail(400, { message: z.prettifyError(parsed.error) });
		}
		const { id } = parsed.data;
		try {
			const result = await Subject.delete({ id });
			if (!result.ok) {
				if (result.reason === 'not_found') {
					return fail(404, { message: 'This subject no longer exists' });
				}
				return fail(409, {
					message: `Cannot delete this subject: it's used by ${result.courseCount} course(s) and ${result.topicCount} topic(s). Move or remove those first`
				});
			}
		} catch (err) {
			console.error('Error deleting subject', { err });
			return fail(500, { message: 'Unknown error' });
		}

		return { ok: true };
	},
	createSubject: async ({ locals, request }) => {
		const fd = await checkUserGetResources({ locals, request });
		const parsed = CreateSubjectFormSchema.safeParse(formToObject(fd));
		if (!parsed.success) {
			return fail(400, { message: z.prettifyError(parsed.error) });
		}
		try {
			await Subject.create({ input: parsed.data });
		} catch (err) {
			console.error('Error creating subject', { err });
			return fail(500, { message: 'Unknown error' });
		}
		return { ok: true };
	}
};
