import { pgTable, text, uuid, integer, char, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tstz, timestamps } from './_columns';
import { paymentStatus } from './enums';
import { bookings } from './bookings';
import { user } from '../auth-schema';

/**
 * Money movement for a booking. 1 booking → many payments (a failed card, then a retry; a
 * saved card, then the real charge). Mirrors a Stripe PaymentIntent and is updated by webhooks.
 *
 * Model: Stripe Connect destination charges. Each student's charge names the tutor's connected
 * account and an application fee (platform commission), so Stripe moves the tutor's share for us
 * and no separate payouts table is needed. Tutor earnings = sum of captured payments.
 */
export const payments = pgTable(
	'payments',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		bookingId: uuid('booking_id')
			.notNull()
			.references(() => bookings.id, { onDelete: 'restrict' }),
		/** Whose card. Today = the student. Separate column so parents can pay later without a migration. */
		payerUserId: text('payer_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'restrict' }),

		status: paymentStatus('status').notNull(),
		currency: char('currency', { length: 3 }).notNull().default('aud'),

		stripePaymentIntentId: text('stripe_payment_intent_id').unique(),
		stripeSetupIntentId: text('stripe_setup_intent_id').unique(),
		stripePaymentMethodId: text('stripe_payment_method_id'),
		/** Snapshot of the tutor's connected account at charge time. */
		stripeDestinationAccountId: text('stripe_destination_account_id'),

		amountAuthorizedCents: integer('amount_authorized_cents'),
		amountCapturedCents: integer('amount_captured_cents'),
		applicationFeeCents: integer('application_fee_cents'),
		amountRefundedCents: integer('amount_refunded_cents').notNull().default(0),

		failureCode: text('failure_code'),
		failureMessage: text('failure_message'),
		authorizedAt: tstz('authorized_at'),
		capturedAt: tstz('captured_at'),
		...timestamps()
	},
	(t) => [
		index('payments_booking_idx').on(t.bookingId),
		index('payments_status_idx').on(t.status),
		check(
			'payments_amounts_chk',
			sql`coalesce(${t.amountCapturedCents}, 0) >= 0 and ${t.amountRefundedCents} >= 0`
		)
	]
);
