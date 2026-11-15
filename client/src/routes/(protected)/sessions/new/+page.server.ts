import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { STUDENT_ACCOUNT_TYPE } from '$lib/constants/profile';
import {
	BOOKING_HORIZON_DAYS,
	DEFAULT_SESSION_MINUTES,
	LOCATION_LABELS,
	SESSION_DURATIONS
} from '$lib/constants/sessions';
import { CreateSessionFormSchema, chapterValue } from '$lib/schemas/forms/booking';
import { BookingIntentSchema } from '$lib/schemas/search/tutors';
import { localDateParts } from '$lib/server/domain/availability';
import { availableStarts, locationOptions, maxBookableGroupSize } from '$lib/server/domain/booking';
import { priceLadder } from '$lib/server/domain/tierPricing';
import { Availability } from '$lib/server/repositories/availability';
import { Pricing } from '$lib/server/repositories/pricing';
import { Session } from '$lib/server/repositories/sessions';
import { SessionBooking } from '$lib/server/repositories/session-booking';
import { Student } from '$lib/server/repositories/student';
import { TutorDirectory } from '$lib/server/repositories/tutor-directory';
import { minutesToLabel } from '$lib/utils/time';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Book a new session with a tutor. Protected by the (protected) layout, so logged-out visitors
 * go to /login?redirectTo=… and come straight back. Only onboarded students can book.
 */
export const load: PageServerLoad = async ({ url, locals }) => {
	if (!locals.user) redirect(303, '/login');

	const intent = BookingIntentSchema.safeParse({
		tutor: url.searchParams.get('tutor') ?? undefined,
		course: url.searchParams.get('course') ?? undefined
	});
	if (!intent.success) redirect(303, '/tutors');

	const tutor = await TutorDirectory.getProfile({ tutorId: intent.data.tutor });
	if (!tutor) error(404, 'Tutor not found');
	const tutorSummary = { id: tutor.id, name: tutor.name, bookable: tutor.bookable };

	if (locals.user.role !== STUDENT_ACCOUNT_TYPE) {
		return { canBook: false as const, reason: 'not_student' as const, tutor: tutorSummary };
	}
	const student = await Student.getProfile({ userId: locals.user.id });
	if (!student?.onboardingCompletedAt) redirect(303, '/onboarding');
	if (!tutor.bookable) {
		return { canBook: false as const, reason: 'not_bookable' as const, tutor: tutorSummary };
	}

	const now = new Date();
	const [teaching, windows, busy, pricing] = await Promise.all([
		TutorDirectory.teachingByCourse({ tutorId: tutor.id }),
		Availability.listForUser({ userId: tutor.id }),
		Session.busyForTutor({
			tutorId: tutor.id,
			from: now,
			to: new Date(now.getTime() + (BOOKING_HORIZON_DAYS + 1) * DAY_MS)
		}),
		Pricing.sheetsWithCurrent({ at: now })
	]);

	// times are shown in the student's zone, grouped by their local day
	const timeZone = student.timezone;
	const dayLabel = new Intl.DateTimeFormat('en-AU', {
		timeZone,
		weekday: 'short',
		day: 'numeric',
		month: 'short'
	});
	const days: {
		key: string;
		label: string;
		times: { iso: string; label: string; durations: number[] }[];
	}[] = [];
	for (const o of availableStarts({ windows, timeZone: tutor.timeZone, busy, now })) {
		const p = localDateParts(o.startsAt, timeZone);
		const key = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
		let day = days.at(-1);
		if (day?.key !== key) {
			day = { key, label: dayLabel.format(o.startsAt), times: [] };
			days.push(day);
		}
		day.times.push({
			iso: o.startsAt.toISOString(),
			label: minutesToLabel(p.minute),
			durations: o.durations
		});
	}

	// the course they came from first
	const courses = [...teaching].sort(
		(a, b) => Number(b.key === intent.data.course) - Number(a.key === intent.data.course)
	);
	const maxGroup = maxBookableGroupSize(tutor.maxGroupSize);

	return {
		canBook: true as const,
		tutor: { ...tutorSummary, suburb: tutor.suburb },
		timeZone,
		days,
		courses: courses.map((c) => ({
			key: c.key,
			label: `Year ${c.yearLevel} ${c.name}${c.state ? ` (${c.state})` : ''}`,
			chapters: c.chapters.map((ch) => ({
				value: chapterValue(c.id, ch.topicId),
				label: `Ch ${ch.chapter} · ${ch.title}`
			}))
		})),
		durations: [...SESSION_DURATIONS],
		defaultDuration: DEFAULT_SESSION_MINUTES,
		maxGroupSize: maxGroup,
		locations: locationOptions(tutor.teachingMode).map((value) => ({
			value,
			label: LOCATION_LABELS[value],
			hint:
				value === 'tutor_venue' && tutor.suburb
					? tutor.suburb
					: value === 'student_home' && !student.postcode
						? 'Add your postcode to your profile first'
						: undefined
		})),
		hasHomePostcode: !!student.postcode,
		/** Per student, fee included, for each length: what the group size does to the price. */
		ladders: Object.fromEntries(
			SESSION_DURATIONS.map((d) => [
				d,
				pricing.current
					? priceLadder({
							sheet: pricing.current,
							baseRateCents: tutor.baseRateCents,
							durationMinutes: d,
							maxGroupSize: maxGroup
						})
					: []
			])
		) as Record<number, { groupSize: number; pricePerStudentCents: number }[]>
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== STUDENT_ACCOUNT_TYPE) {
			return fail(403, { error: 'Only student accounts can book sessions.' });
		}
		const parsed = CreateSessionFormSchema.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) {
			return fail(400, {
				error: parsed.error.issues[0]?.message ?? 'Check the form and try again.'
			});
		}

		const outcome = await SessionBooking.create({ studentId: locals.user.id, form: parsed.data });
		if (!outcome.ok) return fail(outcome.status, { error: outcome.message });
		redirect(303, `/sessions/${outcome.sessionId}?booked=1`);
	}
};
