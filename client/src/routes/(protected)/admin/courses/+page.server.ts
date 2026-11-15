import { Course } from '$lib/server/repositories/courses';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { checkIsAdmin } from '$lib/server/auth/checks';
import {
	CreateCourseFormSchema,
	DeleteCourseFormSchema,
	UpdateCourseFormSchema
} from '$lib/schemas/forms/courses';
import { formToObject } from '$lib/utils/forms';
import z from 'zod';
import { Subject } from '$lib/server/repositories/subjects';

export const load: PageServerLoad = async () => {
	const courseList = await Course.list();
	const subjects = await Subject.list();
	const courses = courseList.map((c) => {
		const subject = subjects.find((s) => s.id === c.course.subjectId);
		return {
			course: {
				...c.course,
				subjectName: subject?.name ?? 'Unknown'
			},
			topicCount: c.topicCount
		};
	});
	return {
		courses,
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
	updateCourse: async ({ locals, request }) => {
		const fd = await checkUserGetResources({ locals, request });
		const parsed = UpdateCourseFormSchema.safeParse(formToObject(fd));
		if (!parsed.success) {
			return fail(400, { message: z.prettifyError(parsed.error) });
		}
		const { id, ...input } = parsed.data;
		try {
			await Course.update({ id, input });
		} catch (err) {
			console.error('Error Updating Course', { err });
			return fail(500, { message: 'Unknown error' });
		}
		return { ok: true };
	},
	deleteCourse: async ({ locals, request }) => {
		const fd = await checkUserGetResources({ locals, request });
		const parsed = DeleteCourseFormSchema.safeParse(formToObject(fd));
		if (!parsed.success) {
			return fail(400, { message: z.prettifyError(parsed.error) });
		}
		const { id } = parsed.data;
		try {
			const result = await Course.delete({ id });
			if (!result.ok) {
				if (result.reason === 'not_found') {
					return fail(404, { message: 'This course does not exist' });
				}
				return fail(409, {
					message: `Cannot delete this course: it's used by ${result.topicCount} topic(s)`
				});
			}
		} catch (err) {
			console.error('Error deleting course', { err });
			return fail(500, { message: 'Unknown error' });
		}

		return { ok: true };
	},
	createCourse: async ({ locals, request }) => {
		const fd = await checkUserGetResources({ locals, request });
		const parsed = CreateCourseFormSchema.safeParse(formToObject(fd));
		if (!parsed.success) {
			return fail(400, { message: z.prettifyError(parsed.error) });
		}

		try {
			await Course.create({ input: parsed.data });
		} catch (err) {
			console.error('Error creating course', { err });
			return fail(500, { message: 'Unknown error' });
		}
		return { ok: true };
	}
};
