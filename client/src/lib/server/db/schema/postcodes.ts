import { pgTable, char, text, doublePrecision, index, primaryKey } from 'drizzle-orm/pg-core';
import { auState } from './enums';

/**
 * Reference data: Australian postcode → suburb + centroid.
 * Used for in-person radius matching (haversine distance between centroids — no PostGIS needed
 * at this scale). Seed from a public postcode dataset.
 *
 * A postcode can cover several suburbs, so the key is (postcode, suburb).
 */
export const postcodes = pgTable(
	'postcodes',
	{
		postcode: char('postcode', { length: 4 }).notNull(),
		suburb: text('suburb').notNull(),
		state: auState('state').notNull(),
		lat: doublePrecision('lat').notNull(),
		lng: doublePrecision('lng').notNull()
	},
	(t) => [
		primaryKey({ columns: [t.postcode, t.suburb] }),
		index('postcodes_postcode_idx').on(t.postcode)
	]
);
