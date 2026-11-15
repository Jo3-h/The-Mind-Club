import { eq } from 'drizzle-orm';
import { db, type Executor } from '../db';
import { studentTopics } from '../db/schema/student-topics';
import { topics } from '../db/schema/topics';

export const StudentTopic = {
	/** The student's chosen topics, with titles. */
	async listForStudent(params: { studentId: string; tx?: Executor }) {
		const { studentId, tx = db } = params;
		return tx
			.select({
				id: topics.id,
				title: topics.title,
				notifyRequestedAt: studentTopics.notifyRequestedAt
			})
			.from(studentTopics)
			.innerJoin(topics, eq(topics.id, studentTopics.topicId))
			.where(eq(studentTopics.studentId, studentId));
	},

	/** Replaces the student's whole topic set (delete + insert) in one transaction. */
	async replace(params: { studentId: string; topicIds: string[]; tx?: Executor }) {
		const { studentId, topicIds, tx = db } = params;
		await tx.transaction(async (t) => {
			await t.delete(studentTopics).where(eq(studentTopics.studentId, studentId));
			if (topicIds.length > 0) {
				await t.insert(studentTopics).values(topicIds.map((topicId) => ({ studentId, topicId })));
			}
		});
	},

	/** "Notify me when there's a match": flags every topic the student picked. */
	async requestNotify(params: { studentId: string; tx?: Executor }) {
		const { studentId, tx = db } = params;
		const rows = await tx
			.update(studentTopics)
			.set({ notifyRequestedAt: new Date() })
			.where(eq(studentTopics.studentId, studentId))
			.returning({ topicId: studentTopics.topicId });
		return rows.length;
	}
};
