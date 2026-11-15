/**
 * Seed the LOCAL database with dev data.  Run:  npm run db:seed:dev
 *
 * Refuses to run against anything that isn't localhost unless you pass --force.
 * Uses relative imports (not $lib / $env) so it runs outside SvelteKit with tsx.
 */
import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/lib/server/db/schema';
import { seedDev, SEED_EMAIL_DOMAIN, SEED_PASSWORD } from '../src/lib/server/db/seed/dev';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const host = new URL(url).hostname;
const isLocal = ['localhost', '127.0.0.1', '::1', 'db', 'postgres'].includes(host);
if ((!isLocal || process.env.NODE_ENV === 'production') && !process.argv.includes('--force')) {
	console.error(`Refusing to seed ${host}. This is dev data. Pass --force if you really mean it.`);
	process.exit(1);
}

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

try {
	const summary = await seedDev(db);
	console.log(
		`\nSeeded ${summary.tutors} tutors, ${summary.students} students, ${summary.sessions} sessions, ${summary.bookings} bookings, ${summary.payments} payments.\n`
	);
	for (const label of summary.sessionLabels) console.log(`  · ${label}`);
	console.log(`\nSign in as any seed user, e.g. priya@${SEED_EMAIL_DOMAIN} / ${SEED_PASSWORD}\n`);
} finally {
	await client.end();
}
