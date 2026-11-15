import { and, asc, count, desc, eq, isNull, or, sql, type SQL } from 'drizzle-orm';
import { topics } from '../db/schema/topics';
import type { AuState } from '$lib/constants/profile';
import { db, type Executor } from '../db';
import { courses } from '../db/schema/courses';
import { courseTopics } from '../db/schema/course-topics';
import { subjects } from '../db/schema/subjects';
import { slugify } from '$lib/utils/slugify';
import type { SubjectRow } from './subjects';
import { pgErrorCode } from '../db/errors';

export type CourseRow = typeof courses.$inferSelect;
export type CreateCourseInput = Pick<
	typeof courses.$inferInsert,
	'name' | 'sortOrder' | 'state' | 'yearLevel'
> & { subjectId: SubjectRow['id'] };
export type UpdateCourseInput = Partial<
	CreateCourseInput & Pick<typeof courses.$inferInsert, 'key' | 'textbook'>
>;
export type DeleteCourseResult =
	| { ok: true }
	| { ok: false; reason: 'not_found' }
	| { ok: false; reason: 'in_use'; topicCount: number };

export const Course = {
	async list(params?: { tx?: Executor }) {
		const { tx = db } = params ?? {};
		return tx
			.select({
				course: courses,
				// cast for Postgres so you get a real number in TS/runtime
				topicCount: sql<number>`cast(count(${courseTopics.topicId}) as int)`
			})
			.from(courses)
			.leftJoin(courseTopics, eq(courseTopics.courseId, courses.id))
			.groupBy(courses.id)
			.orderBy(desc(courses.updatedAt));
	},

	async getById(params: { id: string; tx?: Executor }) {
		const { id, tx = db } = params;
		const [row] = await tx.select().from(courses).where(eq(courses.id, id)).limit(1);
		return row;
	},

	/** The course plus its subject's name, for detail pages. */
	async getDetail(params: { id: string; tx?: Executor }) {
		const { id, tx = db } = params;
		const [row] = await tx
			.select({ course: courses, subjectName: subjects.name })
			.from(courses)
			.innerJoin(subjects, eq(subjects.id, courses.subjectId))
			.where(eq(courses.id, id))
			.limit(1);
		return row;
	},

	async getByKey(params: { key: string; tx?: Executor }) {
		const { key, tx = db } = params;
		const [row] = await tx.select().from(courses).where(eq(courses.key, key)).limit(1);
		return row;
	},

	/**
	 * Active courses in a subject, optionally narrowed by year level and state, each with how many
	 * active chapters it has. A state includes national courses (state NULL); no state = every
	 * state. Ordered by year, then national before state courses, then the admin sort order.
	 */
	async listForSearch(params: {
		subjectId: string;
		yearLevel?: number | null;
		state?: AuState | null;
		tx?: Executor;
	}) {
		const { subjectId, yearLevel, state, tx = db } = params;
		const filters: SQL[] = [eq(courses.subjectId, subjectId), eq(courses.isActive, true)];
		if (yearLevel) filters.push(eq(courses.yearLevel, yearLevel));
		if (state) filters.push(or(isNull(courses.state), eq(courses.state, state))!);
		return tx
			.select({
				course: courses,
				topicCount: sql<number>`cast(count(${topics.id}) filter (where ${topics.isActive}) as int)`
			})
			.from(courses)
			.leftJoin(courseTopics, eq(courseTopics.courseId, courses.id))
			.leftJoin(topics, eq(topics.id, courseTopics.topicId))
			.where(and(...filters))
			.groupBy(courses.id)
			.orderBy(
				asc(courses.yearLevel),
				sql`${courses.state} nulls first`,
				asc(courses.sortOrder),
				asc(courses.name)
			);
	},

	/** All courses for one subject, for pickers. */
	async listBySubject(params: { subjectId: string; tx?: Executor }) {
		const { subjectId, tx = db } = params;
		return tx
			.select()
			.from(courses)
			.where(eq(courses.subjectId, subjectId))
			.orderBy(asc(courses.yearLevel), asc(courses.sortOrder), asc(courses.name));
	},

	async getTopicCount(params: { courseId: string; tx?: Executor }) {
		const { courseId, tx = db } = params;
		const [row] = await tx
			.select({
				topicCount: sql<number>`cast(count(${courseTopics.topicId}) as int)`
			})
			.from(courseTopics)
			.where(eq(courseTopics.courseId, courseId));

		return row?.topicCount ?? 0;
	},

	async create(params: { input: CreateCourseInput; tx?: Executor }) {
		const { input, tx = db } = params;
		const [row] = await tx
			.insert(courses)
			.values({ ...input, key: slugify(input.name), isActive: true })
			.returning();

		console.info('Created Course with parameters', { row });
	},

	async update(params: { id: string; input: UpdateCourseInput; tx?: Executor }) {
		const { id, input, tx = db } = params;
		console.info('Updating Course with parameters', params);
		const [row] = await tx
			.update(courses)
			.set({ ...input, updatedAt: new Date() })
			.where(eq(courses.id, id))
			.returning();
		return row;
	},

	async delete(params: { id: string; tx?: Executor }) {
		const { id, tx = db } = params;
		console.info('Deleting Course', params);
		try {
			const deleted = await tx.transaction((sp) =>
				sp.delete(courses).where(eq(courses.id, id)).returning({ id: courses.id })
			);
			return deleted.length ? { ok: true } : { ok: false, reason: 'not_found' };
		} catch (e) {
			if (pgErrorCode(e) !== '23001') throw e;

			const [[c]] = await Promise.all([
				tx.select({ n: count() }).from(courseTopics).where(eq(courseTopics.courseId, id))
			]);
			return { ok: false, reason: 'in_use', topicCount: c.n };
		}
	}
};
