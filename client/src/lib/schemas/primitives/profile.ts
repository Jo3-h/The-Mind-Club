import * as z from 'zod';
import {
	AVAILABILITY_WINDOWS_MAX,
	GRID_END,
	GRID_START,
	GRID_STEP,
	TOPIC_SELECTION
} from '$lib/constants/onboarding';
import { DEFAULT_TIME_ZONE, POSTCODE_DIGITS, POSTCODE_PATTERN } from '$lib/constants/profile';
import { isValidTimeZone, normaliseWindows } from '$lib/server/domain/availability';

/**
 * Profile-shaped fields shared by onboarding and tutor search.
 * Server-only: availability validation uses the pure domain helpers in $lib/server/domain.
 */

/** Stored as char(4); kept as a string so leading zeros (NT, e.g. 0800) survive. */
export const PostcodeSchema = z
	.string()
	.trim()
	.optional()
	.transform((v) => (v ? v : null))
	.pipe(z.string().regex(POSTCODE_PATTERN, `Enter a ${POSTCODE_DIGITS}-digit postcode`).nullable());

export const TopicIdsSchema = z
	.array(z.uuid('Pick chapters from the list'))
	.min(TOPIC_SELECTION.MIN, 'Pick at least one chapter')
	.max(TOPIC_SELECTION.MAX, 'Too many chapters selected')
	.transform((ids) => [...new Set(ids)]);

export const WindowSchema = z.object({ day: z.number(), start: z.number(), end: z.number() });

/** The availability grid posts JSON. Validated, sorted and merged here. */
export const AvailabilityJsonSchema = z
	.string({ error: 'Mark at least one time you are free' })
	.transform((raw, ctx) => {
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw || '[]');
		} catch {
			ctx.addIssue({ code: 'custom', message: 'Availability could not be read' });
			return z.NEVER;
		}
		const windows = z.array(WindowSchema).max(AVAILABILITY_WINDOWS_MAX).safeParse(parsed);
		if (!windows.success) {
			ctx.addIssue({ code: 'custom', message: 'Availability could not be read' });
			return z.NEVER;
		}
		const result = normaliseWindows(windows.data, {
			min: GRID_START,
			max: GRID_END,
			step: GRID_STEP
		});
		if (!result.ok) {
			ctx.addIssue({ code: 'custom', message: result.error });
			return z.NEVER;
		}
		if (result.windows.length === 0) {
			ctx.addIssue({ code: 'custom', message: 'Mark at least one time you are free' });
			return z.NEVER;
		}
		return result.windows;
	});

/** The browser's zone, sent as a hidden field. Falls back to the dev default. */
export const TimeZoneSchema = z
	.string()
	.optional()
	.transform((v) => (v && isValidTimeZone(v) ? v : DEFAULT_TIME_ZONE));
