import { pgTable, text, uuid, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tstz } from './_columns';
import { availabilityExceptionKind } from './enums';
import { user } from '../auth-schema';

/**
 * One-off changes to the weekly pattern: holidays, a sick day, an extra Saturday.
 * These are real moments, so unlike weekly_availability they ARE stored as timestamptz.
 */
export const availabilityExceptions = pgTable(
	'availability_exceptions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		kind: availabilityExceptionKind('kind').notNull().default('blocked'),
		startsAt: tstz('starts_at').notNull(),
		endsAt: tstz('ends_at').notNull(),
		note: text('note'),
		createdAt: tstz('created_at').notNull().defaultNow()
	},
	(t) => [
		index('availability_exceptions_user_idx').on(t.userId, t.startsAt),
		check('ae_range_chk', sql`${t.endsAt} > ${t.startsAt}`)
	]
);
