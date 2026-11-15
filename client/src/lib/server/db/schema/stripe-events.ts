import { pgTable, text } from 'drizzle-orm/pg-core';
import { tstz } from './_columns';

/**
 * Every Stripe webhook event we've received, keyed by Stripe's event id.
 * Stripe retries and can deliver the same event twice; insert-or-skip on this table first and
 * you process each event exactly once.
 */
export const stripeEvents = pgTable('stripe_events', {
	id: text('id').primaryKey(), // evt_…
	type: text('type').notNull(),
	receivedAt: tstz('received_at').notNull().defaultNow(),
	processedAt: tstz('processed_at')
});
