import { and, asc, eq, inArray } from 'drizzle-orm';
import { db, type Executor } from '../db';
import { courseTopics } from '../db/schema/course-topics';
import { courses } from '../db/schema/courses';
import { topics } from '../db/schema/topics';
import { isUniqueViolation } from '../db/errors';

export type CourseTopicRow = typeof courseTopics.$inferSelect;
/** The chapter/page references that can be set on a course–topic link. */
export type CourseTopicReferenceInput = Pick<
	typeof courseTopics.$inferInsert,
	'chapterNumber' | 'chapterTitle' | 'pageStart' | 'pageEnd' | 'notes'
>;
export type AddCourseTopicResult =
	{ ok: true; row: CourseTopicRow } | { ok: false; reason: 'exists' };

const linkWhere = (courseId: string, topicId: string) =>
	and(eq(courseTopics.courseId, courseId), eq(courseTopics.topicId, topicId));

export const CourseTopic = {
	/** Every course a topic appears in, with the link's references. Ordered by year, then course. */
	async listByTopic(params: { topicId: string; tx?: Executor }) {
		const { topicId, tx = db } = params;
		return tx
			.select({ link: courseTopics, course: courses })
			.from(courseTopics)
			.innerJoin(courses, eq(courses.id, courseTopics.courseId))
			.where(eq(courseTopics.topicId, topicId))
			.orderBy(asc(courses.yearLevel), asc(courses.sortOrder), asc(courses.name));
	},

	/** Active chapter ids for several courses at once, keyed by course id. */
	async activeTopicIdsByCourse(params: {
		courseIds: string[];
		tx?: Executor;
	}): Promise<Map<string, string[]>> {
		const { courseIds, tx = db } = params;
		const out = new Map<string, string[]>();
		if (courseIds.length === 0) return out;
		const rows = await tx
			.select({ courseId: courseTopics.courseId, topicId: courseTopics.topicId })
			.from(courseTopics)
			.innerJoin(topics, eq(topics.id, courseTopics.topicId))
			.where(and(inArray(courseTopics.courseId, courseIds), eq(topics.isActive, true)))
			.orderBy(asc(courseTopics.chapterNumber));
		for (const r of rows) out.set(r.courseId, [...(out.get(r.courseId) ?? []), r.topicId]);
		return out;
	},

	/** Every topic in a course, with the link's references. Ordered by chapter. */
	async listByCourse(params: { courseId: string; tx?: Executor }) {
		const { courseId, tx = db } = params;
		return tx
			.select({ link: courseTopics, topic: topics })
			.from(courseTopics)
			.innerJoin(topics, eq(topics.id, courseTopics.topicId))
			.where(eq(courseTopics.courseId, courseId))
			.orderBy(asc(courseTopics.chapterNumber));
	},

	async add(params: {
		courseId: string;
		topicId: string;
		input: CourseTopicReferenceInput;
		tx?: Executor;
	}): Promise<AddCourseTopicResult> {
		const { courseId, topicId, input, tx = db } = params;
		console.info('Adding Topic to Course', params);
		try {
			// Save point, so a duplicate doesn't poison an outer transaction.
			const [row] = await tx.transaction((sp) =>
				sp
					.insert(courseTopics)
					.values({ ...input, courseId, topicId })
					.returning()
			);
			return { ok: true, row };
		} catch (e) {
			if (!isUniqueViolation(e)) throw e;
			return { ok: false, reason: 'exists' };
		}
	},

	/** Returns undefined if the link doesn't exist. */
	async update(params: {
		courseId: string;
		topicId: string;
		input: Partial<CourseTopicReferenceInput>;
		tx?: Executor;
	}) {
		const { courseId, topicId, input, tx = db } = params;
		console.info('Updating Course Topic', params);
		const [row] = await tx
			.update(courseTopics)
			.set({ ...input, updatedAt: new Date() })
			.where(linkWhere(courseId, topicId))
			.returning();
		return row;
	},

	/** Returns true if a link was removed. */
	async remove(params: { courseId: string; topicId: string; tx?: Executor }) {
		const { courseId, topicId, tx = db } = params;
		console.info('Removing Topic from Course', params);
		const deleted = await tx
			.delete(courseTopics)
			.where(linkWhere(courseId, topicId))
			.returning({ topicId: courseTopics.topicId });
		return deleted.length > 0;
	}
};
