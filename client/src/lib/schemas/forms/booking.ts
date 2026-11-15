import * as z from 'zod';
import { POSTCODE_PATTERN } from '$lib/constants/profile';
import {
	GROUP_SIZE,
	MEETING_HOSTS,
	MEETING_URL_MAX_LENGTH,
	SESSION_DURATIONS,
	VENUE_LENGTH
} from '$lib/constants/sessions';
import { NumberLike } from '../primitives/number-like';
import { RequiredText } from '../primitives/text';
import { TutorIdSchema } from '../search/tutors';

/** Route param for /sessions/[sessionId]. Anything that isn't a uuid is a 404, not a DB error. */
export const SessionIdSchema = z.uuid();

const isMeetingHost = (hostname: string) =>
	MEETING_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));

/** True for an https link on an allowed meeting host. */
export function isAllowedMeetingUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return (
			url.protocol === 'https:' && !url.username && !url.password && isMeetingHost(url.hostname)
		);
	} catch {
		return false;
	}
}

/** A tutor's meeting link. '' clears it (null). */
export const MeetingUrlSchema = z
	.string()
	.trim()
	.max(MEETING_URL_MAX_LENGTH, `Meeting link must be ${MEETING_URL_MAX_LENGTH} characters or fewer`)
	.transform((v) => (v ? v : null))
	.refine(
		(v) => v === null || isAllowedMeetingUrl(v),
		'Use an https link from Zoom, Google Meet, Microsoft Teams or Whereby'
	);

export const MeetingLinkFormSchema = z.object({ meetingUrl: MeetingUrlSchema });

const DurationSchema = NumberLike('Length').pipe(
	z
		.number()
		.refine((n) => (SESSION_DURATIONS as readonly number[]).includes(n), 'Pick a session length')
);

const GroupSizeSchema = NumberLike('Group size').pipe(
	z
		.int('Group size must be a whole number')
		.min(GROUP_SIZE.MIN, `Group size must be at least ${GROUP_SIZE.MIN}`)
		.max(GROUP_SIZE.MAX, `Group size must be at most ${GROUP_SIZE.MAX}`)
);

/** Chapter select value: "courseId|topicId", so one select (grouped by course) carries both. */
export const chapterValue = (courseId: string, topicId: string) => `${courseId}|${topicId}`;

const ChapterSchema = z
	.string({ error: 'Pick a chapter' })
	.transform((v) => v.split('|'))
	.pipe(z.tuple([z.uuid(), z.uuid()], { error: 'Pick a chapter' }))
	.transform(([courseId, topicId]) => ({ courseId, topicId }));

const bookingBase = {
	tutor: TutorIdSchema,
	chapter: ChapterSchema,
	startsAt: z.iso
		.datetime({ offset: true, error: 'Pick a start time' })
		.transform((v) => new Date(v)),
	durationMinutes: DurationSchema,
	groupSize: GroupSizeSchema
};

/**
 * The "Book a session" form. Everything here is re-checked against fresh data in the booking
 * transaction (the tutor teaches the chapter, the time is still free, the group fits their max).
 */
export const CreateSessionFormSchema = z.discriminatedUnion(
	'locationType',
	[
		z.object({ ...bookingBase, locationType: z.literal('online') }),
		z.object({ ...bookingBase, locationType: z.literal('tutor_venue') }),
		z.object({ ...bookingBase, locationType: z.literal('student_home') }),
		z.object({
			...bookingBase,
			locationType: z.literal('public_venue'),
			venue: RequiredText('Venue', VENUE_LENGTH),
			venuePostcode: z
				.string({ error: 'Venue postcode is required' })
				.trim()
				.regex(POSTCODE_PATTERN, 'Enter a 4-digit postcode')
		})
	],
	{ error: 'Pick where the session happens' }
);

export type CreateSessionForm = z.output<typeof CreateSessionFormSchema>;
