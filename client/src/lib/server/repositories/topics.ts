import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { db, type Executor } from '../db';
import { topics } from '../db/schema/topics';
import { courseTopics } from '../db/schema/course-topics';
import { subjects } from '../db/schema/subjects';
import { slugify } from '$lib/utils/slugify';
import { pgErrorCode } from '../db/errors';
import type { SubjectRow } from './subjects';

export type TopicRow = typeof topics.$inferSelect;
export type CreateTopicInput = Pick<typeof topics.$inferInsert, 'title'> & {
	subjectId: SubjectRow['id'];
};
export type UpdateTopicInput = Partial<CreateTopicInput & Pick<typeof topics.$inferInsert, 'key'>>;
export type DeleteTopicResult =
	| { ok: true }
	| { ok: false; reason: 'not_found' }
	| { ok: false; reason: 'in_use'; courseCount: number };

export const Topic = {
	async list(params?: { tx?: Executor }) {
		const { tx = db } = params ?? {};
		return tx
			.select({
				topic: topics,
				// cast for Postgres so you get a real number in TS/runtime
				courseCount: sql<number>`cast(count(${courseTopics.courseId}) as int)`
			})
			.from(topics)
			.leftJoin(courseTopics, eq(courseTopics.topicId, topics.id))
			.groupBy(topics.id)
			.orderBy(desc(topics.updatedAt));
	},
	async getById(params: { id: string; tx?: Executor }) {
		const { id, tx = db } = params;
		const [row] = await tx.select().from(topics).where(eq(topics.id, id)).limit(1);
		return row;
	},
	/** Which of `ids` are real, active topics. Used to validate ids sent from a form. */
	async filterActiveIds(params: { ids: string[]; tx?: Executor }) {
		const { ids, tx = db } = params;
		if (ids.length === 0) return [];
		const rows = await tx
			.select({ id: topics.id })
			.from(topics)
			.where(and(inArray(topics.id, ids), eq(topics.isActive, true)));
		return rows.map((r) => r.id);
	},
	/** All topics for one subject, for pickers. */
	async listBySubject(params: { subjectId: string; tx?: Executor }) {
		const { subjectId, tx = db } = params;
		return tx
			.select()
			.from(topics)
			.where(eq(topics.subjectId, subjectId))
			.orderBy(asc(topics.title));
	},
	/** The topic plus its subject's name, for detail pages. */
	async getDetail(params: { id: string; tx?: Executor }) {
		const { id, tx = db } = params;
		const [row] = await tx
			.select({ topic: topics, subjectName: subjects.name })
			.from(topics)
			.innerJoin(subjects, eq(subjects.id, topics.subjectId))
			.where(eq(topics.id, id))
			.limit(1);
		return row;
	},
	async getByKey(params: { key: string; tx?: Executor }) {
		const { key, tx = db } = params;
		const [row] = await tx.select().from(topics).where(eq(topics.key, key)).limit(1);
		return row;
	},
	async create(params: { input: CreateTopicInput; tx?: Executor }) {
		const { input, tx = db } = params;
		const [row] = await tx
			.insert(topics)
			.values({ ...input, key: slugify(input.title), isActive: true })
			.returning();
		console.info('Created Topic with parameters', { row });
		return row;
	},
	async update(params: { id: string; input: UpdateTopicInput; tx?: Executor }) {
		const { id, input, tx = db } = params;
		console.info('Updating Topic with parameters', { id, input });
		const [row] = await tx
			.update(topics)
			.set({ ...input, updatedAt: new Date() })
			.where(eq(topics.id, id))
			.returning();
		return row;
	},
	async delete(params: { id: string; tx?: Executor }): Promise<DeleteTopicResult> {
		const { id, tx = db } = params;

		console.info('Deleting Topic', params);
		try {
			// Nested transaction = save point, so a failed delete doesn't
			// poison an outer transaction the caller may have open.
			const deleted = await tx.transaction((sp) =>
				sp.delete(topics).where(eq(topics.id, id)).returning({ id: topics.id })
			);
			return deleted.length ? { ok: true } : { ok: false, reason: 'not_found' };
		} catch (e) {
			if (pgErrorCode(e) !== '23001') throw e;

			const [[c]] = await Promise.all([
				tx.select({ n: count() }).from(courseTopics).where(eq(courseTopics.topicId, id))
			]);
			return { ok: false, reason: 'in_use', courseCount: c.n };
		}
	}
};
