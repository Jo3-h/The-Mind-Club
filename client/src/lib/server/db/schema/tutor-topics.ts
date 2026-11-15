import { pgTable, text, uuid, primaryKey, index } from 'drizzle-orm/pg-core';
import { tstz } from './_columns';
import { tutorProfiles } from './tutor-profiles';
import { topics } from './topics';

/**
 * What a tutor can teach, at topic level — the source of truth for matching.
 * "Tick the whole course" in the UI expands to one row per topic.
 */
export const tutorTopics = pgTable(
	'tutor_topics',
	{
		tutorId: text('tutor_id')
			.notNull()
			.references(() => tutorProfiles.userId, { onDelete: 'cascade' }),
		topicId: uuid('topic_id')
			.notNull()
			.references(() => topics.id, { onDelete: 'cascade' }),
		createdAt: tstz('created_at').notNull().defaultNow()
	},
	(t) => [
		primaryKey({ columns: [t.tutorId, t.topicId] }),
		// matching starts from the topic: "who teaches X?"
		index('tutor_topics_topic_idx').on(t.topicId)
	]
);
