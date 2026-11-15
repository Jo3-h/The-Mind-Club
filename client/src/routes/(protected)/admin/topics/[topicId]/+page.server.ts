import { error, fail } from '@sveltejs/kit';
import z from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { checkIsAdmin } from '$lib/server/auth/checks';
import { formToObject } from '$lib/utils/forms';
import { Topic } from '$lib/server/repositories/topics';
import { Course } from '$lib/server/repositories/courses';
import { Subject } from '$lib/server/repositories/subjects';
import { CourseTopic } from '$lib/server/repositories/course-topics';
import { UpdateTopicFormSchema } from '$lib/schemas/forms/topics';
import {
	AddCourseTopicFormSchema,
	RemoveCourseTopicFormSchema,
	UpdateCourseTopicFormSchema
} from '$lib/schemas/forms/course-topics';

const TopicIdSchema = z.uuid();

/** The topic id comes from the URL only. A malformed id is a 404, not a DB error. */
function parseTopicId(raw: string) {
	const parsed = TopicIdSchema.safeParse(raw);
	if (!parsed.success) error(404, 'Topic not found');
	return parsed.data;
}

export const load: PageServerLoad = async ({ params }) => {
	const topicId = parseTopicId(params.topicId);
	const detail = await Topic.getDetail({ id: topicId });
	if (!detail) error(404, 'Topic not found');

	const [links, subjectCourses, subjects] = await Promise.all([
		CourseTopic.listByTopic({ topicId }),
		Course.listBySubject({ subjectId: detail.topic.subjectId }),
		Subject.list()
	]);

	// Courses this topic could still be added to: same subject, not already linked.
	const linked = new Set(links.map((l) => l.course.id));
	const availableCourses = subjectCourses.filter((c) => !linked.has(c.id));

	return {
		topic: { ...detail.topic, subjectName: detail.subjectName },
		links,
		availableCourses,
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
	updateTopic: async ({ locals, request, params }) => {
		const fd = await checkUserGetResources({ locals, request });
		const topicId = parseTopicId(params.topicId);
		// id comes from the route; ignore any id in the form body
		const parsed = UpdateTopicFormSchema.safeParse({ ...formToObject(fd), id: topicId });
		if (!parsed.success) {
			return fail(400, { message: z.prettifyError(parsed.error) });
		}
		const { id, ...input } = parsed.data;
		try {
			const current = await Topic.getById({ id });
			if (!current) return fail(404, { message: 'This topic no longer exists' });

			// Topics can only sit in courses of their own subject, so the subject is locked
			// while the topic is in any course.
			if (input.subjectId !== current.subjectId) {
				const links = await CourseTopic.listByTopic({ topicId: id });
				if (links.length > 0) {
					return fail(409, {
						message: `Cannot change the subject: this topic is in ${links.length} course(s). Remove it from those first`
					});
				}
			}
			await Topic.update({ id, input });
		} catch (err) {
			console.error('Error updating topic', { err });
			return fail(500, { message: 'Unknown error' });
		}
		return { ok: true };
	},

	addToCourse: async ({ locals, request, params }) => {
		const fd = await checkUserGetResources({ locals, request });
		const topicId = parseTopicId(params.topicId);
		const parsed = AddCourseTopicFormSchema.safeParse(formToObject(fd));
		if (!parsed.success) {
			return fail(400, { message: z.prettifyError(parsed.error) });
		}
		const { courseId, ...input } = parsed.data;
		try {
			const [topic, course] = await Promise.all([
				Topic.getById({ id: topicId }),
				Course.getById({ id: courseId })
			]);
			if (!topic) return fail(404, { message: 'This topic no longer exists' });
			if (!course) return fail(404, { message: 'That course no longer exists' });
			if (course.subjectId !== topic.subjectId) {
				return fail(400, { message: 'That course is in a different subject to this topic' });
			}

			const result = await CourseTopic.add({ courseId, topicId, input });
			if (!result.ok) {
				return fail(409, { message: 'This topic is already in that course' });
			}
		} catch (err) {
			console.error('Error adding topic to course', { err });
			return fail(500, { message: 'Unknown error' });
		}
		return { ok: true };
	},

	updateCourseLink: async ({ locals, request, params }) => {
		const fd = await checkUserGetResources({ locals, request });
		const topicId = parseTopicId(params.topicId);
		const parsed = UpdateCourseTopicFormSchema.safeParse(formToObject(fd));
		if (!parsed.success) {
			return fail(400, { message: z.prettifyError(parsed.error) });
		}
		const { courseId, ...input } = parsed.data;
		try {
			const row = await CourseTopic.update({ courseId, topicId, input });
			if (!row) return fail(404, { message: 'This topic is no longer in that course' });
		} catch (err) {
			console.error('Error updating course topic', { err });
			return fail(500, { message: 'Unknown error' });
		}
		return { ok: true };
	},

	removeFromCourse: async ({ locals, request, params }) => {
		const fd = await checkUserGetResources({ locals, request });
		const topicId = parseTopicId(params.topicId);
		const parsed = RemoveCourseTopicFormSchema.safeParse(formToObject(fd));
		if (!parsed.success) {
			return fail(400, { message: z.prettifyError(parsed.error) });
		}
		try {
			const removed = await CourseTopic.remove({ courseId: parsed.data.courseId, topicId });
			if (!removed) return fail(404, { message: 'This topic is no longer in that course' });
		} catch (err) {
			console.error('Error removing topic from course', { err });
			return fail(500, { message: 'Unknown error' });
		}
		return { ok: true };
	}
};
