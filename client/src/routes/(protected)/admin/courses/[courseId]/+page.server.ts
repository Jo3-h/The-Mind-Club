import { error, fail } from '@sveltejs/kit';
import z from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { checkIsAdmin } from '$lib/server/auth/checks';
import { formToObject } from '$lib/utils/forms';
import { Course } from '$lib/server/repositories/courses';
import { Topic } from '$lib/server/repositories/topics';
import { Subject } from '$lib/server/repositories/subjects';
import { CourseTopic } from '$lib/server/repositories/course-topics';
import { UpdateCourseDetailsFormSchema } from '$lib/schemas/forms/courses';
import {
	AddTopicToCourseFormSchema,
	RemoveTopicFromCourseFormSchema,
	UpdateTopicInCourseFormSchema
} from '$lib/schemas/forms/course-topics';

const CourseIdSchema = z.uuid();

/** The course id comes from the URL only. A malformed id is a 404, not a DB error. */
function parseCourseId(raw: string) {
	const parsed = CourseIdSchema.safeParse(raw);
	if (!parsed.success) error(404, 'Course not found');
	return parsed.data;
}

export const load: PageServerLoad = async ({ params }) => {
	const courseId = parseCourseId(params.courseId);
	const detail = await Course.getDetail({ id: courseId });
	if (!detail) error(404, 'Course not found');

	const [links, subjectTopics, subjects] = await Promise.all([
		CourseTopic.listByCourse({ courseId }),
		Topic.listBySubject({ subjectId: detail.course.subjectId }),
		Subject.list()
	]);

	// Topics that could still be added: same subject, not already in this course.
	const linked = new Set(links.map((l) => l.topic.id));
	const availableTopics = subjectTopics.filter((t) => !linked.has(t.id));

	return {
		course: { ...detail.course, subjectName: detail.subjectName },
		links,
		availableTopics,
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
	updateCourse: async ({ locals, request, params }) => {
		const fd = await checkUserGetResources({ locals, request });
		const id = parseCourseId(params.courseId);
		const parsed = UpdateCourseDetailsFormSchema.safeParse(formToObject(fd));
		if (!parsed.success) {
			return fail(400, { message: z.prettifyError(parsed.error) });
		}
		const input = parsed.data;
		try {
			const current = await Course.getById({ id });
			if (!current) return fail(404, { message: 'This course no longer exists' });

			// Topics can only sit in courses of their own subject, so the subject is locked
			// while the course has any topics.
			if (input.subjectId !== current.subjectId) {
				const topicCount = await Course.getTopicCount({ courseId: id });
				if (topicCount > 0) {
					return fail(409, {
						message: `Cannot change the subject: this course has ${topicCount} topic(s). Remove them first`
					});
				}
			}
			await Course.update({ id, input });
		} catch (err) {
			console.error('Error updating course', { err });
			return fail(500, { message: 'Unknown error' });
		}
		return { ok: true };
	},

	addTopic: async ({ locals, request, params }) => {
		const fd = await checkUserGetResources({ locals, request });
		const courseId = parseCourseId(params.courseId);
		const parsed = AddTopicToCourseFormSchema.safeParse(formToObject(fd));
		if (!parsed.success) {
			return fail(400, { message: z.prettifyError(parsed.error) });
		}
		const { topicId, ...input } = parsed.data;
		try {
			const [course, topic] = await Promise.all([
				Course.getById({ id: courseId }),
				Topic.getById({ id: topicId })
			]);
			if (!course) return fail(404, { message: 'This course no longer exists' });
			if (!topic) return fail(404, { message: 'That topic no longer exists' });
			if (topic.subjectId !== course.subjectId) {
				return fail(400, { message: 'That topic is in a different subject to this course' });
			}

			const result = await CourseTopic.add({ courseId, topicId, input });
			if (!result.ok) {
				return fail(409, { message: 'That topic is already in this course' });
			}
		} catch (err) {
			console.error('Error adding topic to course', { err });
			return fail(500, { message: 'Unknown error' });
		}
		return { ok: true };
	},

	updateTopicLink: async ({ locals, request, params }) => {
		const fd = await checkUserGetResources({ locals, request });
		const courseId = parseCourseId(params.courseId);
		const parsed = UpdateTopicInCourseFormSchema.safeParse(formToObject(fd));
		if (!parsed.success) {
			return fail(400, { message: z.prettifyError(parsed.error) });
		}
		const { topicId, ...input } = parsed.data;
		try {
			const row = await CourseTopic.update({ courseId, topicId, input });
			if (!row) return fail(404, { message: 'That topic is no longer in this course' });
		} catch (err) {
			console.error('Error updating course topic', { err });
			return fail(500, { message: 'Unknown error' });
		}
		return { ok: true };
	},

	removeTopic: async ({ locals, request, params }) => {
		const fd = await checkUserGetResources({ locals, request });
		const courseId = parseCourseId(params.courseId);
		const parsed = RemoveTopicFromCourseFormSchema.safeParse(formToObject(fd));
		if (!parsed.success) {
			return fail(400, { message: z.prettifyError(parsed.error) });
		}
		try {
			const removed = await CourseTopic.remove({ courseId, topicId: parsed.data.topicId });
			if (!removed) return fail(404, { message: 'That topic is no longer in this course' });
		} catch (err) {
			console.error('Error removing topic from course', { err });
			return fail(500, { message: 'Unknown error' });
		}
		return { ok: true };
	}
};
