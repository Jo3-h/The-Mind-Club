import { asc, count, eq } from 'drizzle-orm';
import type { Executor } from '../db';
import { db } from '../db';
import { subjects } from '../db/schema/subjects';
import { slugify } from '$lib/utils/slugify';
import { pgErrorCode } from '../db/errors';
import { courses } from '../db/schema/courses';
import { topics } from '../db/schema/topics';

export type SubjectRow = typeof subjects.$inferSelect;
export type CreateSubjectInput = Pick<typeof subjects.$inferInsert, 'name' | 'key' | 'sortOrder'>;
export type UpdateSubjectInput = Partial<CreateSubjectInput>;
export type DeleteSubjectResult =
	| { ok: true }
	| { ok: false; reason: 'not_found' }
	| { ok: false; reason: 'in_use'; courseCount: number; topicCount: number };

export const Subject = {
	async list(params?: { tx?: Executor }) {
		const { tx = db } = params ?? {};
		return tx.select().from(subjects);
	},
	/** For pickers: in the admin-set order, then by name. */
	async listOrdered(params?: { tx?: Executor }) {
		const { tx = db } = params ?? {};
		return tx.select().from(subjects).orderBy(asc(subjects.sortOrder), asc(subjects.name));
	},
	async getById(params: { id: string; tx?: Executor }) {
		const { id, tx = db } = params;
		const [row] = await tx.select().from(subjects).where(eq(subjects.id, id)).limit(1);
		return row;
	},
	async getByKey(params: { key: string; tx?: Executor }) {
		const { key, tx = db } = params;
		const [row] = await tx.select().from(subjects).where(eq(subjects.key, key)).limit(1);
		return row;
	},
	async create(params: { input: CreateSubjectInput; tx?: Executor }) {
		const { input, tx = db } = params;
		const [row] = await tx
			.insert(subjects)
			.values({ ...input, key: slugify(input.name) })
			.returning();
		console.info('Created Subject with parameters', { row });
		return row;
	},
	async update(params: { id: string; input: UpdateSubjectInput; tx?: Executor }) {
		const { id, input, tx = db } = params;
		console.info('Updating Subject with parameters', { id, input });
		const [row] = await tx
			.update(subjects)
			.set({ ...input, updatedAt: new Date() })
			.where(eq(subjects.id, id))
			.returning();
		return row;
	},
	async delete(params: { id: string; tx?: Executor }): Promise<DeleteSubjectResult> {
		const { id, tx = db } = params;

		console.info('Deleting Subject', params);
		try {
			// Nested transaction = save point, so a failed delete doesn't
			// poison an outer transaction the caller may have open.
			const deleted = await tx.transaction((sp) =>
				sp.delete(subjects).where(eq(subjects.id, id)).returning({ id: subjects.id })
			);
			return deleted.length ? { ok: true } : { ok: false, reason: 'not_found' };
		} catch (e) {
			if (pgErrorCode(e) !== '23001') throw e;

			const [[c], [t]] = await Promise.all([
				tx.select({ n: count() }).from(courses).where(eq(courses.subjectId, id)),
				tx.select({ n: count() }).from(topics).where(eq(topics.subjectId, id))
			]);
			return { ok: false, reason: 'in_use', courseCount: c.n, topicCount: t.n };
		}
	}
};
