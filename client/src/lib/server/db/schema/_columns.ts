import { timestamp, uuid } from 'drizzle-orm/pg-core';

/** Primary key for every table we own. (Better Auth's tables use text ids — FKs to `user` are text.) */
export const id = () => uuid('id').primaryKey().defaultRandom();

/** All instants are timestamptz. Never store a moment in time without a zone. */
export const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const timestamps = () => ({
	createdAt: tstz('created_at').notNull().defaultNow(),
	updatedAt: tstz('updated_at')
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
});
