import { db, type Executor } from '../db';
import { pgErrorCode } from '../db/errors';
import {
	availableStarts,
	isStartAvailable,
	locationOptions,
	maxBookableGroupSize,
	overlaps,
	sessionShape,
	travelCheck
} from '../domain/booking';
import {
	getJoinabilityReason,
	pricingGroupSize,
	seatsHeld,
	type JoinabilityReason
} from '../domain/joinability';
import { canLeaveSession } from '../domain/sessionLifecycle';
import { priceAtGroupSize } from '../domain/tierPricing';
import { BOOKING_HORIZON_DAYS } from '$lib/constants/sessions';
import type { CreateSessionForm } from '$lib/schemas/forms/booking';
import { Availability } from './availability';
import { Booking } from './bookings';
import { Postcode } from './postcodes';
import { Pricing } from './pricing';
import { Session } from './sessions';
import { Student } from './student';
import { Tutor } from './tutor';
import { TutorDirectory } from './tutor-directory';

/**
 * Creating, joining and leaving sessions. Each runs in ONE transaction and re-checks every rule
 * on fresh data, because forms are only a snapshot of what was true when the page loaded.
 *
 * No payments yet: bookings are created 'confirmed'. When Stripe lands they'll start 'pending'
 * (with expires_at) and become 'confirmed' once a card is saved.
 *
 * Prices stored on bookings are TUTOR prices (see bookings.price_cap_cents).
 */

export type BookingOutcome =
	{ ok: true; sessionId: string } | { ok: false; status: 400 | 404 | 409; message: string };

const fail = (status: 400 | 404 | 409, message: string): BookingOutcome => ({
	ok: false,
	status,
	message
});

const DAY_MS = 24 * 60 * 60 * 1000;

const EXCLUSION_VIOLATION = '23P01';
const UNIQUE_VIOLATION = '23505';

export const JOIN_BLOCKED: Record<Exclude<JoinabilityReason, 'joinable'>, string> = {
	private: 'This is a private session.',
	unavailable: 'This session is no longer running.',
	locked: 'This session has locked: the group is final 24 hours before it starts.',
	already_booked: "You're already in this session.",
	full: 'This session is full.'
};

/** The student's onboarded profile, or a failure. */
async function bookingStudent(studentId: string, tx: Executor) {
	const profile = await Student.getProfile({ userId: studentId, tx });
	return profile?.onboardingCompletedAt ? profile : null;
}

export const SessionBooking = {
	/** First student books a new session: creates the session and their confirmed seat. */
	async create(params: {
		studentId: string;
		form: CreateSessionForm;
		now?: Date;
	}): Promise<BookingOutcome> {
		const { studentId, form, now = new Date() } = params;
		const end = new Date(form.startsAt.getTime() + form.durationMinutes * 60000);

		try {
			return await db.transaction(async (tx) => {
				const student = await bookingStudent(studentId, tx);
				if (!student) return fail(400, 'Finish setting up your account before booking.');

				const [tutor, tutorRow] = await Promise.all([
					TutorDirectory.getProfile({ tutorId: form.tutor, tx }),
					Tutor.getProfile({ userId: form.tutor, tx })
				]);
				if (!tutor || !tutorRow) return fail(404, 'Tutor not found.');
				if (!tutor.bookable || tutor.baseRateCents === null) {
					return fail(409, `${tutor.name} isn't taking bookings yet.`);
				}

				// what: a chapter this tutor teaches, in the course it was picked from
				const teaching = await TutorDirectory.teachingByCourse({ tutorId: tutor.id, tx });
				const course = teaching.find((c) => c.id === form.chapter.courseId);
				if (!course?.chapters.some((ch) => ch.topicId === form.chapter.topicId)) {
					return fail(400, `${tutor.name} doesn't teach that chapter.`);
				}

				// how many
				if (form.groupSize > maxBookableGroupSize(tutor.maxGroupSize)) {
					return fail(
						400,
						`${tutor.name} teaches groups of up to ${maxBookableGroupSize(tutor.maxGroupSize)}.`
					);
				}

				// where
				if (!locationOptions(tutor.teachingMode).includes(form.locationType)) {
					return fail(400, `${tutor.name} doesn't teach there.`);
				}
				let where: { suburb: string | null; postcode: string | null; addressLine: string | null } =
					{
						suburb: null,
						postcode: null,
						addressLine: null
					};
				if (form.locationType === 'tutor_venue') {
					where = { suburb: tutor.suburb, postcode: tutorRow.postcode, addressLine: null };
				} else if (form.locationType === 'public_venue' || form.locationType === 'student_home') {
					const postcode =
						form.locationType === 'public_venue' ? form.venuePostcode : student.postcode;
					if (!postcode) return fail(400, 'Add your postcode to your profile to book at home.');
					const place = await Postcode.locate({ postcode, tx });
					// ASSUMPTION: an unknown postcode (not in our table yet) is allowed through
					const travel = travelCheck({
						tutorLocation: tutor.location,
						travelRadiusKm: tutor.travelRadiusKm,
						place
					});
					if (travel === 'too_far') {
						return fail(
							400,
							`That's further than ${tutor.name} travels (${tutor.travelRadiusKm} km).`
						);
					}
					where = {
						suburb: place?.suburb ?? null,
						postcode,
						addressLine: form.locationType === 'public_venue' ? form.venue : null
					};
				}

				// when: still inside their hours, not overlapping their sessions, still open (D1)
				const [busy, studentBusy] = await Promise.all([
					Session.busyForTutor({
						tutorId: tutor.id,
						from: now,
						to: new Date(now.getTime() + (BOOKING_HORIZON_DAYS + 1) * DAY_MS),
						tx
					}),
					Session.busyForStudent({ studentId, from: form.startsAt, to: end, tx })
				]);
				const options = availableStarts({
					windows: await Availability.listForUser({ userId: tutor.id, tx }),
					timeZone: tutor.timeZone,
					busy,
					now
				});
				if (!isStartAvailable(options, form.startsAt, form.durationMinutes)) {
					return fail(409, 'That time is no longer available. Pick another.');
				}
				if (studentBusy.some((b) => overlaps(b, { startsAt: form.startsAt, endsAt: end }))) {
					return fail(409, 'You already have a session at that time.');
				}

				// price: snapshot today's scheme and the tutor's rate; the first student pays at most
				// the solo price, and less as others join
				const scheme = await Pricing.currentScheme({ at: now, tx });
				const sheet = scheme
					? (await Pricing.sheetsForSchemes({ schemeIds: [scheme.id], tx })).get(scheme.id)
					: undefined;
				const soloPrice = sheet
					? priceAtGroupSize({
							tiers: sheet.tiers,
							baseRateCents: tutor.baseRateCents,
							durationMinutes: form.durationMinutes,
							groupSize: 1
						})
					: null;
				if (!scheme || soloPrice === null) return fail(409, 'Pricing isn’t set up yet.');

				const session = await Session.insert({
					values: {
						tutorId: tutor.id,
						topicId: form.chapter.topicId,
						courseId: form.chapter.courseId,
						startsAt: form.startsAt,
						endsAt: end,
						locationType: form.locationType,
						...where,
						...sessionShape({ locationType: form.locationType, groupSize: form.groupSize }),
						baseRateCents: tutor.baseRateCents,
						pricingSchemeId: scheme.id,
						createdByUserId: studentId
					},
					tx
				});
				await Booking.insert({
					values: {
						sessionId: session.id,
						studentId,
						status: 'confirmed',
						priceCapCents: soloPrice,
						confirmedAt: now
					},
					tx
				});
				return { ok: true, sessionId: session.id } as const;
			});
		} catch (e) {
			// the database's no-overlap rule caught someone booking the same slot a moment earlier
			if (pgErrorCode(e) === EXCLUSION_VIOLATION) {
				return fail(409, 'Someone just booked that time. Pick another.');
			}
			throw e;
		}
	},

	/** A student joins an open session at the price for the group they make. */
	async join(params: {
		studentId: string;
		sessionId: string;
		now?: Date;
	}): Promise<BookingOutcome> {
		const { studentId, sessionId, now = new Date() } = params;
		try {
			return await db.transaction(async (tx) => {
				if (!(await bookingStudent(studentId, tx))) {
					return fail(400, 'Finish setting up your account before joining.');
				}
				// lock first: nobody else can take a seat until we commit
				const session = await Session.lockById({ id: sessionId, tx });
				if (!session) return fail(404, 'Session not found.');

				const seats = await Booking.listForSession({ sessionId, tx });
				const reason = getJoinabilityReason(
					{ ...session, seatsTaken: seatsHeld(seats, now) },
					{
						alreadyBooked: seats.some((b) => b.studentId === studentId && b.status !== 'cancelled')
					},
					now
				);
				if (reason !== 'joinable') return fail(409, JOIN_BLOCKED[reason]);

				const clash = await Session.busyForStudent({
					studentId,
					from: session.startsAt,
					to: session.endsAt,
					tx
				});
				if (clash.length > 0) return fail(409, 'You already have a session at that time.');

				const sheet = (
					await Pricing.sheetsForSchemes({ schemeIds: [session.pricingSchemeId], tx })
				).get(session.pricingSchemeId);
				const price = sheet
					? priceAtGroupSize({
							tiers: sheet.tiers,
							baseRateCents: session.baseRateCents,
							durationMinutes: Math.round(
								(session.endsAt.getTime() - session.startsAt.getTime()) / 60000
							),
							groupSize: pricingGroupSize(seats) + 1
						})
					: null;
				if (price === null) return fail(409, 'Pricing isn’t set up for this session.');

				await Booking.insert({
					values: {
						sessionId,
						studentId,
						status: 'confirmed',
						priceCapCents: price,
						confirmedAt: now
					},
					tx
				});
				return { ok: true, sessionId } as const;
			});
		} catch (e) {
			if (pgErrorCode(e) === UNIQUE_VIOLATION) return fail(409, JOIN_BLOCKED.already_booked);
			throw e;
		}
	},

	/**
	 * A student leaves before the lock. Everyone else keeps their price cap, so nobody pays more
	 * than they agreed to. If nobody is left, the session is cancelled and the slot frees up.
	 */
	async leave(params: {
		studentId: string;
		sessionId: string;
		now?: Date;
	}): Promise<BookingOutcome> {
		const { studentId, sessionId, now = new Date() } = params;
		return db.transaction(async (tx) => {
			const session = await Session.lockById({ id: sessionId, tx });
			if (!session) return fail(404, 'Session not found.');
			const booking = await Booking.findLive({ sessionId, studentId, tx });
			if (!booking) return fail(404, "You're not in this session.");
			if (!canLeaveSession(session, booking, now)) {
				return fail(409, 'This session has locked, so you can no longer leave it here.');
			}

			await Booking.cancel({ id: booking.id, byUserId: studentId, reason: 'student_left', tx });
			const remaining = seatsHeld(await Booking.listForSession({ sessionId, tx }), now);
			if (remaining === 0) await Session.cancel({ id: sessionId, reason: 'All students left', tx });
			return { ok: true, sessionId } as const;
		});
	}
};
