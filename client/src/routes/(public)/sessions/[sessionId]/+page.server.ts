import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	ADMIN_ACCOUNT_TYPE,
	DEFAULT_TIME_ZONE,
	STUDENT_ACCOUNT_TYPE
} from '$lib/constants/profile';
import { JOIN_OPENS_MINUTES_BEFORE, LOCATION_LABELS } from '$lib/constants/sessions';
import { SessionIdSchema } from '$lib/schemas/forms/booking';
import { splitCharge, withBookingFee } from '$lib/server/domain/feeSplit';
import { getJoinabilityReason, pricingGroupSize, seatsHeld } from '$lib/server/domain/joinability';
import { canLeaveSession, lockTimeFor, sessionPhase } from '$lib/server/domain/sessionLifecycle';
import { priceAtGroupSize, sessionPrices } from '$lib/server/domain/tierPricing';
import { Booking } from '$lib/server/repositories/bookings';
import { Pricing } from '$lib/server/repositories/pricing';
import { JOIN_BLOCKED, SessionBooking } from '$lib/server/repositories/session-booking';
import { Session } from '$lib/server/repositories/sessions';
import { Student } from '$lib/server/repositories/student';

const LIVE = new Set(['pending', 'confirmed']);

/**
 * One session. Public while it's an open group anyone could join (so it can be shared); private
 * sessions, and anything no longer running, are only visible to the tutor and its students.
 * The address / venue is only shown to people in the session.
 */
export const load: PageServerLoad = async ({ params, locals, url }) => {
	const id = SessionIdSchema.safeParse(params.sessionId);
	if (!id.success) error(404, 'Session not found');

	const session = await Session.getDetail({ id: id.data });
	if (!session) error(404, 'Session not found');
	const bookings = await Booking.listForSession({ sessionId: session.id });

	const viewerId = locals.user?.id ?? null;
	const isTutor = viewerId === session.tutorId;
	const myBooking = bookings.find((b) => b.studentId === viewerId && b.status !== 'cancelled');
	const inSession = isTutor || (!!myBooking && LIVE.has(myBooking.status));
	const isAdmin = locals.user?.role === ADMIN_ACCOUNT_TYPE;
	const publicListing = session.visibility === 'open' && session.status === 'scheduled';
	// anyone who was ever booked can still see it (e.g. after leaving cancelled the session)
	const wasBooked = bookings.some((b) => b.studentId === viewerId);
	if (!publicListing && !isTutor && !wasBooked && !isAdmin) error(404, 'Session not found');

	let timeZone = DEFAULT_TIME_ZONE;
	if (isTutor) timeZone = session.tutor.timeZone;
	else if (locals.user?.role === STUDENT_ACCOUNT_TYPE) {
		timeZone = (await Student.getProfile({ userId: locals.user.id }))?.timezone ?? timeZone;
	}

	const now = new Date();
	const phase = sessionPhase(session, now);
	const seatsTaken = seatsHeld(bookings, now);
	const groupSize = pricingGroupSize(bookings);
	const sheet = (await Pricing.sheetsForSchemes({ schemeIds: [session.pricingSchemeId] })).get(
		session.pricingSchemeId
	);

	const prices = sheet
		? sessionPrices({
				sheet,
				baseRateCents: session.baseRateCents,
				durationMinutes: session.durationMinutes,
				groupSize,
				capacity: session.capacity
			})
		: null;
	// tutor price per student at today's group size; each student pays the lower of this and their cap
	const tutorPriceNow = sheet
		? priceAtGroupSize({
				tiers: sheet.tiers,
				baseRateCents: session.baseRateCents,
				durationMinutes: session.durationMinutes,
				groupSize: Math.max(1, groupSize)
			})
		: null;
	const finalFor = (capCents: number) =>
		tutorPriceNow === null ? capCents : Math.min(capCents, tutorPriceNow);

	const joinReason = getJoinabilityReason(
		{ ...session, seatsTaken },
		viewerId ? { alreadyBooked: !!myBooking && LIVE.has(myBooking.status) } : null,
		now
	);

	const isOnline = session.locationType === 'online';
	const joinOpensAt = new Date(session.startsAt.getTime() - JOIN_OPENS_MINUTES_BEFORE * 60000);
	const meetingReady =
		isOnline && inSession ? !!(await Session.meetingUrl({ id: session.id })) : false;

	return {
		session: {
			id: session.id,
			topicTitle: session.topicTitle,
			courseLabel: session.courseLabel,
			tutor: { id: session.tutor.id, name: session.tutor.name, image: session.tutor.image },
			startsAt: session.startsAt.toISOString(),
			endsAt: session.endsAt.toISOString(),
			durationMinutes: session.durationMinutes,
			lockAt: lockTimeFor(session.startsAt).toISOString(),
			capacity: session.capacity,
			visibility: session.visibility,
			locationType: session.locationType,
			locationLabel: LOCATION_LABELS[session.locationType],
			suburb: session.suburb,
			/** Venue / address: only for people in the session. */
			addressLine: inSession ? session.addressLine : null,
			cancelReason: session.status === 'cancelled' ? session.cancelReason : null
		},
		phase,
		timeZone,
		seatsTaken,
		groupSize,
		prices,
		viewer: {
			loggedIn: !!viewerId,
			isStudent: locals.user?.role === STUDENT_ACCOUNT_TYPE,
			isTutor,
			inSession
		},
		join: {
			reason: joinReason,
			message: joinReason === 'joinable' ? null : JOIN_BLOCKED[joinReason]
		},
		myBooking:
			myBooking && sheet
				? {
						status: myBooking.status,
						/** What they'll pay now, and the most they'll ever pay. Fee included. */
						payNowCents: withBookingFee(finalFor(myBooking.priceCapCents), sheet.studentFeeBps),
						capCents: withBookingFee(myBooking.priceCapCents, sheet.studentFeeBps),
						canLeave: canLeaveSession(session, myBooking, now)
					}
				: null,
		/** The tutor's view: who's in, and what they'd earn at today's group size. */
		roster:
			isTutor && sheet
				? {
						students: bookings
							.filter((b) => b.status !== 'cancelled')
							.map((b) => ({ name: b.studentName, status: b.status })),
						earningsCents: bookings
							.filter((b) => b.status === 'confirmed')
							.reduce(
								(sum, b) => sum + splitCharge(finalFor(b.priceCapCents), sheet).tutorPayoutCents,
								0
							)
					}
				: null,
		meeting: isOnline
			? {
					ready: meetingReady,
					opensAt: joinOpensAt.toISOString(),
					open: inSession && phase !== 'cancelled' && now >= joinOpensAt && now < session.endsAt
				}
			: null,
		justBooked: url.searchParams.has('booked')
	};
};

function requireUser(locals: App.Locals, sessionId: string) {
	if (!locals.user)
		redirect(303, `/login?redirectTo=${encodeURIComponent(`/sessions/${sessionId}`)}`);
	return locals.user;
}

export const actions: Actions = {
	join: async ({ params, locals }) => {
		const id = SessionIdSchema.safeParse(params.sessionId);
		if (!id.success) error(404, 'Session not found');
		const user = requireUser(locals, id.data);
		if (user.role !== STUDENT_ACCOUNT_TYPE)
			return fail(403, { error: 'Only students can join sessions.' });

		const outcome = await SessionBooking.join({ studentId: user.id, sessionId: id.data });
		if (!outcome.ok) return fail(outcome.status, { error: outcome.message });
		return { joined: true };
	},

	leave: async ({ params, locals }) => {
		const id = SessionIdSchema.safeParse(params.sessionId);
		if (!id.success) error(404, 'Session not found');
		const user = requireUser(locals, id.data);

		const outcome = await SessionBooking.leave({ studentId: user.id, sessionId: id.data });
		if (!outcome.ok) return fail(outcome.status, { error: outcome.message });
		return { left: true };
	}
};
