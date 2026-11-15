import { eq } from 'drizzle-orm';
import { db, type Executor } from '../db';
import { tutorTopics } from '../db/schema/tutor-topics';

export const TutorTopic = {
	/** Replaces the tutor's whole topic set (delete + insert) in one transaction. */
	async replace(params: { tutorId: string; topicIds: string[]; tx?: Executor }) {
		const { tutorId, topicIds, tx = db } = params;
		await tx.transaction(async (t) => {
			await t.delete(tutorTopics).where(eq(tutorTopics.tutorId, tutorId));
			if (topicIds.length > 0) {
				await t.insert(tutorTopics).values(topicIds.map((topicId) => ({ tutorId, topicId })));
			}
		});
	}
};
