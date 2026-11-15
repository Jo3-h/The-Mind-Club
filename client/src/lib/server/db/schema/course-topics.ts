import { pgTable, uuid, smallint, primaryKey, index, text, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { courses } from './courses';
import { topics } from './topics';
import { timestamps } from './_columns';

/**
 * Which topics a course contains, and in what order.
 * Chapter number lives HERE because it differs per course (and per textbook, later).
 * The textbook itself is set on the course (`courses.textbook`); the chapter/page
 * references below point into that book.
 */
export const courseTopics = pgTable(
	'course_topics',
	{
		courseId: uuid('course_id')
			.notNull()
			.references(() => courses.id, { onDelete: 'cascade' }),
		topicId: uuid('topic_id')
			.notNull()
			.references(() => topics.id, { onDelete: 'restrict' }),
		chapterNumber: smallint('chapter_number').notNull(),
		/** The textbook's own name for the chapter, if it differs from the topic title. */
		chapterTitle: text('chapter_title'),
		/** Page range in the course's textbook. Both optional. */
		pageStart: smallint('page_start'),
		pageEnd: smallint('page_end'),
		/** Admin/tutor notes for this topic within this course, e.g. "skip 4.3". */
		notes: text('notes'),
		...timestamps()
	},
	(t) => [
		primaryKey({ columns: [t.courseId, t.topicId] }),
		index('course_topics_topic_idx').on(t.topicId),
		check('course_topics_chapter_number_chk', sql`${t.chapterNumber} > 0`),
		check(
			'course_topics_pages_chk',
			sql`${t.pageStart} is null or ${t.pageEnd} is null or ${t.pageEnd} >= ${t.pageStart}`
		)
	]
);
