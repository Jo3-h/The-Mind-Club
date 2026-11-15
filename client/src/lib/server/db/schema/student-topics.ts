import { pgTable, text, uuid, date, primaryKey, index } from 'drizzle-orm/pg-core';
import { tstz } from './_columns';
import { studentProfiles } from './student-profiles';
import { topics } from './topics';

/**
 * Topics a student wants help with (from onboarding and later edits). Drives recommendations
 * and "notify me when there's a match". The term-long lesson plan (lesson_plans / plan_items)
 * can be added later as new tables without touching this one.
 */
export const studentTopics = pgTable(
	'student_topics',
	{
		studentId: text('student_id')
			.notNull()
			.references(() => studentProfiles.userId, { onDelete: 'cascade' }),
		topicId: uuid('topic_id')
			.notNull()
			.references(() => topics.id, { onDelete: 'cascade' }),
		/** Optional "test on Ch 4 in 3 weeks" — used to rank urgency. */
		neededBy: date('needed_by'),
		/** Set when they want match alerts for this topic; cleared once notified. */
		notifyRequestedAt: tstz('notify_requested_at'),
		createdAt: tstz('created_at').notNull().defaultNow()
	},
	(t) => [
		primaryKey({ columns: [t.studentId, t.topicId] }),
		index('student_topics_topic_idx').on(t.topicId)
	]
);
