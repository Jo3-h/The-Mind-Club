import { pgTable, text, integer, uuid, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tstz } from './_columns';

/**
 * A version of the platform-wide pricing curve + fees.
 *
 * Schemes are IMMUTABLE once any session uses them. To change pricing, insert a new scheme with a
 * later active_from. Every session snapshots the scheme it was created under, so old sessions keep
 * their prices and your revenue history stays explainable.
 */
export const pricingSchemes = pgTable(
	'pricing_schemes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		name: text('name').notNull(), // "Launch pricing"
		/** Taken out of the tutor's price before payout, in basis points: 500 = 5%. */
		platformFeeBps: integer('platform_fee_bps').notNull(),
		/**
		 * Booking fee added on top of the tutor's price, paid by the student, in basis points.
		 * Always shown INSIDE student-facing prices (see domain/feeSplit.ts).
		 */
		studentFeeBps: integer('student_fee_bps').notNull().default(500),
		/** The current scheme = latest active_from <= now(). */
		activeFrom: tstz('active_from').notNull(),
		createdAt: tstz('created_at').notNull().defaultNow()
	},
	(t) => [
		check('ps_fee_chk', sql`${t.platformFeeBps} between 0 and 10000`),
		check('ps_student_fee_chk', sql`${t.studentFeeBps} between 0 and 10000`)
	]
);
