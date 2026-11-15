import { pgTable, text, uuid, boolean, index } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_columns';
import { subjects } from './subjects';

/**
 * The unit of matching: one textbook chapter's worth of content ("Differentiation").
 *
 * Deliberately has NO year level, state or chapter number — those belong to the course it
 * appears in (see course_topics). That lets the same topic sit in SA Year 11 Methods AND
 * VIC Year 12 Methods, so students from both states pool into the same sessions.
 */
export const topics = pgTable(
	'topics',
	{
		id: id(),
		/** Permanent slug, e.g. "maths-differentiation-intro". Seed upserts on this. Never reuse. */
		key: text('key').notNull().unique(),
		subjectId: uuid('subject_id')
			.notNull()
			.references(() => subjects.id, { onDelete: 'restrict' }),
		title: text('title').notNull(),
		isActive: boolean('is_active').notNull().default(true),
		...timestamps()
	},
	(t) => [index('topics_subject_idx').on(t.subjectId)]
);
