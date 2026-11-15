// Relative imports only: this is also used by scripts/load-postcodes.ts, which runs outside
// SvelteKit (no $lib alias).
import * as z from 'zod';
import { AU_BOUNDS, SUBURB_NAME_MAX_LENGTH } from '../../constants/geo';
import { POSTCODE_DIGITS, STATES } from '../../constants/profile';

/** "GLENELG NORTH" → "Glenelg North", "MCLAREN VALE" → "Mclaren Vale". Good enough for display. */
export function titleCaseSuburb(raw: string): string {
	return raw
		.trim()
		.toLowerCase()
		.replace(/(^|[\s'-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/**
 * One row of a postcode dataset → a `postcodes` row. Spreadsheets often drop leading zeros
 * (NT "0800" → "800"), so short postcodes are padded back to 4 digits.
 */
export const PostcodeRowSchema = z.object({
	postcode: z
		.string()
		.trim()
		.regex(/^\d{3,4}$/)
		.transform((v) => v.padStart(POSTCODE_DIGITS, '0')),
	suburb: z.string().trim().min(1).max(SUBURB_NAME_MAX_LENGTH).transform(titleCaseSuburb),
	state: z.string().trim().toUpperCase().pipe(z.enum(STATES)),
	lat: z.coerce.number().min(AU_BOUNDS.LAT_MIN).max(AU_BOUNDS.LAT_MAX),
	lng: z.coerce.number().min(AU_BOUNDS.LNG_MIN).max(AU_BOUNDS.LNG_MAX)
});

export type PostcodeRow = z.output<typeof PostcodeRowSchema>;

/** Common header names in public datasets, mapped to our fields. */
export const POSTCODE_COLUMN_ALIASES: Record<keyof PostcodeRow, string[]> = {
	postcode: ['postcode', 'post_code', 'pcode'],
	suburb: ['locality', 'suburb', 'place_name', 'name'],
	state: ['state', 'state_code', 'state_abbr'],
	lat: ['lat', 'latitude'],
	lng: ['long', 'lng', 'lon', 'longitude']
};
