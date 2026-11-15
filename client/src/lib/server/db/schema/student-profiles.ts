import { pgTable, text, char, smallint, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tstz, timestamps } from './_columns';
import { auState, deliveryPreference, groupPreference } from './enums';
import { user } from '../auth-schema';

/**
 * One row per student, 1:1 with `user` (user.role = 'student'). The account holder IS the student.
 */
export const studentProfiles = pgTable(
	'student_profiles',
	{
		userId: text('user_id')
			.primaryKey()
			.references(() => user.id, { onDelete: 'cascade' }),

		state: auState('state'),
		/** IANA zone. Their weekly availability is in this zone. */
		timezone: text('timezone').notNull().default('Australia/Adelaide'),
		postcode: char('postcode', { length: 4 }),
		school: text('school'),

		/**
		 * The calendar year they finish Year 12 — NOT their year level.
		 * Year level goes stale every January; this never does.
		 *   current year level = 12 - (graduation_year - current school year)
		 * Onboarding asks "what year are you in?" and converts on save.
		 */
		graduationYear: smallint('graduation_year'),

		deliveryPreference: deliveryPreference('delivery_preference'),
		groupPreference: groupPreference('group_preference').notNull().default('any'),

		onboardingCompletedAt: tstz('onboarding_completed_at'),
		...timestamps()
	},
	(t) => [
		check(
			'student_location_chk',
			sql`${t.onboardingCompletedAt} is null or ${t.deliveryPreference} = 'online' or ${t.postcode} is not null`
		)
	]
);
