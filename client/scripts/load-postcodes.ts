/**
 * Load an Australian postcode dataset into `postcodes` (used for in-person distance matching).
 *
 *   npm run db:load:postcodes -- path/to/postcodes.csv
 *
 * Bring your own CSV; nothing is downloaded. It needs a header row with postcode, suburb/locality,
 * state and latitude/longitude columns (common names are recognised, see POSTCODE_COLUMN_ALIASES).
 * A widely used free source is Matthew Proctor's "Australian Postcodes" dataset; check its licence
 * before using it in production.
 *
 * Idempotent: existing (postcode, suburb) rows are left alone. Invalid rows are skipped and counted.
 * Refuses to run against anything that isn't localhost unless you pass --force.
 * Uses relative imports (not $lib / $env) so it runs outside SvelteKit with tsx.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { postcodes } from '../src/lib/server/db/schema/postcodes';
import {
	POSTCODE_COLUMN_ALIASES,
	PostcodeRowSchema,
	type PostcodeRow
} from '../src/lib/schemas/data/postcodes';

const BATCH_SIZE = 1000;

/** Minimal CSV parser: handles quoted fields, escaped quotes ("") and CRLF. */
function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (quoted) {
			if (ch === '"' && text[i + 1] === '"') {
				field += '"';
				i++;
			} else if (ch === '"') {
				quoted = false;
			} else {
				field += ch;
			}
		} else if (ch === '"') {
			quoted = true;
		} else if (ch === ',') {
			row.push(field);
			field = '';
		} else if (ch === '\n' || ch === '\r') {
			if (ch === '\r' && text[i + 1] === '\n') i++;
			row.push(field);
			if (row.some((f) => f !== '')) rows.push(row);
			row = [];
			field = '';
		} else {
			field += ch;
		}
	}
	row.push(field);
	if (row.some((f) => f !== '')) rows.push(row);
	return rows;
}

function columnIndexes(header: string[]) {
	const normalised = header.map((h) => h.trim().toLowerCase());
	const out = {} as Record<keyof PostcodeRow, number>;
	for (const [field, aliases] of Object.entries(POSTCODE_COLUMN_ALIASES)) {
		const index = normalised.findIndex((h) => aliases.includes(h));
		if (index === -1) {
			throw new Error(`No column for "${field}". Expected one of: ${aliases.join(', ')}`);
		}
		out[field as keyof PostcodeRow] = index;
	}
	return out;
}

const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!file) {
	console.error('Usage: npm run db:load:postcodes -- path/to/postcodes.csv');
	process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const host = new URL(url).hostname;
const isLocal = ['localhost', '127.0.0.1', '::1', 'db', 'postgres'].includes(host);
if ((!isLocal || process.env.NODE_ENV === 'production') && !process.argv.includes('--force')) {
	console.error(`Refusing to load into ${host}. Pass --force if you really mean it.`);
	process.exit(1);
}

const [header, ...lines] = parseCsv(readFileSync(file, 'utf8'));
const cols = columnIndexes(header);

const valid = new Map<string, PostcodeRow>();
let invalid = 0;
for (const line of lines) {
	const parsed = PostcodeRowSchema.safeParse({
		postcode: line[cols.postcode],
		suburb: line[cols.suburb],
		state: line[cols.state],
		lat: line[cols.lat],
		lng: line[cols.lng]
	});
	if (!parsed.success) {
		invalid++;
		continue;
	}
	// datasets repeat a locality per delivery area; keep the first (postcode, suburb)
	const key = `${parsed.data.postcode}|${parsed.data.suburb}`;
	if (!valid.has(key)) valid.set(key, parsed.data);
}

const client = postgres(url, { max: 1 });
const db = drizzle(client);
try {
	const rows = [...valid.values()];
	let inserted = 0;
	for (let i = 0; i < rows.length; i += BATCH_SIZE) {
		const result = await db
			.insert(postcodes)
			.values(rows.slice(i, i + BATCH_SIZE))
			.onConflictDoNothing()
			.returning({ postcode: postcodes.postcode });
		inserted += result.length;
	}
	console.log(
		`Read ${lines.length} rows: ${rows.length} unique valid, ${invalid} invalid skipped. Inserted ${inserted} new.`
	);
} finally {
	await client.end();
}
