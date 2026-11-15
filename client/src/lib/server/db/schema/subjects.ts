import { pgTable, text, smallint } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_columns';

/**
 * Broad discipline: Mathematics, Chemistry, Physics, English…
 * Maths Methods / Specialist / General are COURSES within Mathematics, not separate subjects.
 */
export const subjects = pgTable('subjects', {
	id: id(),
	/** Permanent slug, e.g. "mathematics". Seed upserts on this. Never change it. */
	key: text('key').notNull().unique(),
	name: text('name').notNull(),
	sortOrder: smallint('sort_order').notNull().default(0),
	...timestamps()
});
