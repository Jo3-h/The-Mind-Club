import * as z from 'zod';
import { CURRICULUM_KEY_LENGTH } from '$lib/constants/curriculum';
import { POSTCODE_PATTERN, STATES, YEAR_LEVELS } from '$lib/constants/profile';
import { ANY_FILTER, SEARCH_MODES, TIME_SLOT_CODES } from '$lib/constants/search';
import { isValidTimeZone } from '$lib/server/domain/availability';
import { NumberLike } from '../primitives/number-like';

/**
 * The /tutors URL is the search state. Every field is optional and forgiving: a bad or stale
 * value is dropped (never a 400), because people share and bookmark search links.
 *
 *   ?subject=maths&state=SA&year=11     state/year narrow the course list; "any" = no filter
 *   &course=sa-11-methods               one specific course (else every matching course)
 *   &when=2-after&when=4-evening        time slots (repeatable, see TIME_SLOT_CODES)
 *   &mine=1                             use my saved availability (logged-in students)
 *   &mode=in_person&postcode=5000&tz=Australia/Adelaide&page=2
 */

const SLUG = new RegExp(`^[a-z0-9-]{1,${CURRICULUM_KEY_LENGTH.MAX}}$`);
const VALID_SLOTS = new Set(TIME_SLOT_CODES);

const Slug = z.string().regex(SLUG).optional().catch(undefined);

/**
 * A filter that a logged-in student's profile can pre-fill: undefined = not in the URL (use the
 * profile), null = explicitly "any" (ignore the profile), otherwise the value.
 */
const Prefillable = <T extends z.ZodType>(schema: T) =>
	z
		.union([z.literal(ANY_FILTER).transform(() => null), schema])
		.optional()
		.catch(undefined);

export const TutorSearchParamsSchema = z.object({
	subject: Slug,
	state: Prefillable(z.enum(STATES)),
	year: Prefillable(NumberLike('Year').pipe(z.literal(YEAR_LEVELS))),
	course: Slug,
	when: z
		.array(z.string())
		.catch([])
		.transform((codes) => [...new Set(codes.filter((c) => VALID_SLOTS.has(c)))]),
	mine: z
		.string()
		.optional()
		.catch(undefined)
		.transform((v) => v === '1'),
	mode: z.enum(SEARCH_MODES).catch('either'),
	postcode: z.string().regex(POSTCODE_PATTERN).optional().catch(undefined),
	tz: z
		.string()
		.optional()
		.catch(undefined)
		.transform((v) => (v && isValidTimeZone(v) ? v : undefined)),
	page: NumberLike('Page').pipe(z.number().int().min(1)).catch(1)
});

export type TutorSearchParams = z.output<typeof TutorSearchParamsSchema>;

/** URLSearchParams → validated search params. Never throws. */
export function parseTutorSearchParams(params: URLSearchParams): TutorSearchParams {
	const single = (key: string) => params.get(key) ?? undefined;
	return TutorSearchParamsSchema.parse({
		subject: single('subject'),
		state: single('state'),
		year: single('year'),
		course: single('course'),
		when: params.getAll('when'),
		mine: single('mine'),
		mode: single('mode') ?? 'either',
		postcode: single('postcode'),
		tz: single('tz'),
		page: single('page') ?? '1'
	});
}

/** Better Auth user ids are opaque text, not UUIDs: accept a conservative id shape only. */
export const TutorIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/** /sessions/new?tutor=…&course=… — where "Book a session" sends people. */
export const BookingIntentSchema = z.object({
	tutor: TutorIdSchema,
	course: z.string().regex(SLUG).optional().catch(undefined)
});
