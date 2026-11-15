import { pgTable, text, smallint, uuid, boolean, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { id, timestamps } from './_columns';
import { auState } from './enums';
import { subjects } from './subjects';

/**
 * A course is one pickable block of chapters at ONE year level — what the UI calls a CurriculumGroup.
 *
 *   Year 10 Mathematics           state = NULL  (national list)
 *   Year 11 Mathematical Methods  state = 'SA'  (SACE Stage 1)
 *   Year 12 Mathematical Methods  state = 'VIC' (VCE Units 3&4)
 *
 * Every topic reaches students through a course — junior years included (as national courses).
 * One path for every query beats a special case for juniors.
 */
export const courses = pgTable(
	'courses',
	{
		id: id(),
		/** Permanent slug, e.g. "sa-11-methods", "au-10-maths". Seed upserts on this. */
		key: text('key').notNull().unique(),
		subjectId: uuid('subject_id')
			.notNull()
			.references(() => subjects.id, { onDelete: 'restrict' }),
		yearLevel: smallint('year_level').notNull(),
		/** NULL = applies in every state. */
		state: auState('state'),
		name: text('name').notNull(), // "Mathematical Methods"
		/**
		 * Free-text textbook reference, e.g. "Cambridge Senior Maths: Mathematical Methods Units 1&2 (2nd ed.)".
		 * NULL = no textbook set. Kept as a string for now; can become a FK to a textbooks table later.
		 */
		textbook: text('textbook'),
		/** Hide without deleting (deleting would orphan history). */
		isActive: boolean('is_active').notNull().default(true),
		sortOrder: smallint('sort_order').notNull().default(0),
		...timestamps()
	},
	(t) => [
		index('courses_lookup_idx').on(t.yearLevel, t.state),
		check('courses_year_level_chk', sql`${t.yearLevel} between 7 and 12`)
	]
);
