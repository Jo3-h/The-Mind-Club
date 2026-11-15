import { asc, eq, inArray } from 'drizzle-orm';
import { db, type Executor } from '../db';
import { postcodes } from '../db/schema/postcodes';
import type { LatLng } from '../domain/geo';

export type PostcodeLocation = LatLng & { postcode: string; suburb: string };

export const Postcode = {
	/**
	 * Where a postcode is. A postcode can cover several suburbs; their centroids are close
	 * enough for radius matching, so the first suburb alphabetically stands in for all of them.
	 */
	async locate(params: { postcode: string; tx?: Executor }): Promise<PostcodeLocation | null> {
		const { postcode, tx = db } = params;
		const [row] = await tx
			.select()
			.from(postcodes)
			.where(eq(postcodes.postcode, postcode))
			.orderBy(asc(postcodes.suburb))
			.limit(1);
		return row ? { postcode: row.postcode, suburb: row.suburb, lat: row.lat, lng: row.lng } : null;
	},

	/** Many postcodes at once, keyed by postcode. Unknown postcodes are simply absent. */
	async locateMany(params: {
		postcodes: string[];
		tx?: Executor;
	}): Promise<Map<string, PostcodeLocation>> {
		const { tx = db } = params;
		const wanted = [...new Set(params.postcodes)];
		const out = new Map<string, PostcodeLocation>();
		if (wanted.length === 0) return out;
		const rows = await tx
			.select()
			.from(postcodes)
			.where(inArray(postcodes.postcode, wanted))
			.orderBy(asc(postcodes.postcode), asc(postcodes.suburb));
		for (const r of rows) {
			if (!out.has(r.postcode)) {
				out.set(r.postcode, { postcode: r.postcode, suburb: r.suburb, lat: r.lat, lng: r.lng });
			}
		}
		return out;
	}
};
