import type { PageServerLoad } from './$types';
import {
	DEFAULT_TIME_ZONE,
	STUDENT_ACCOUNT_TYPE,
	TUTOR_ACCOUNT_TYPE
} from '$lib/constants/profile';
import { LOCATION_LABELS } from '$lib/constants/sessions';
import { splitCharge, withBookingFee } from '$lib/server/domain/feeSplit';
import { pricingGroupSize, seatsHeld } from '$lib/server/domain/joinability';
import { sessionPhase } from '$lib/server/domain/sessionLifecycle';
import { priceAtGroupSize } from '$lib/server/domain/tierPricing';
import { Booking } from '$lib/server/repositories/bookings';
import { Pricing, type SchemeSheet } from '$lib/server/repositories/pricing';
import { Session, type SessionRow } from '$lib/server/repositories/sessions';
import { Student } from '$lib/server/repositories/student';
import { Tutor } from '$lib/server/repositories/tutor';

type SessionBookings = Awaited<ReturnType<typeof Booking.listForSession>>;

/** Tutor price per student at the session's current group size. */
function tutorPriceNow(session: SessionRow, bookings: SessionBookings, sheet: SchemeSheet) {
	return priceAtGroupSize({
		tiers: sheet.tiers,
		baseRateCents: session.baseRateCents,
		durationMinutes: Math.round((session.endsAt.getTime() - session.startsAt.getTime()) / 60000),
		groupSize: Math.max(1, pricingGroupSize(bookings))
	});
}

function where(session: SessionRow) {
	const label =
		session.locationType === 'student_home' ? 'At home' : LOCATION_LABELS[session.locationType];
	return session.suburb && session.locationType !== 'online'
		? `${label} · ${session.suburb}`
		: label;
}

/**
 * "My sessions": a student's bookings, or a tutor's sessions. Upcoming and past.
 * Everything is scoped to the logged-in user by the queries themselves; no ids come from the client.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user!; // (protected) layout guarantees it
	const now = new Date();

	if (user.role === STUDENT_ACCOUNT_TYPE) {
		const [profile, upcoming, past] = await Promise.all([
			Student.getProfile({ userId: user.id }),
			Booking.listForStudent({ studentId: user.id, when: 'upcoming', now }),
			Booking.listForStudent({ studentId: user.id, when: 'past', now })
		]);
		// a booking they cancelled (left) isn't "their session" any more
		const rows = [...upcoming, ...past].filter((r) => r.booking.status !== 'cancelled');
		const sessionIds = rows.map((r) => r.session.id);
		const [bookingsBySession, sheets] = await Promise.all([
			Booking.listForSessions({ sessionIds }),
			Pricing.sheetsForSchemes({ schemeIds: rows.map((r) => r.session.pricingSchemeId) })
		]);

		const shape = (r: (typeof rows)[number]) => {
			const bookings = bookingsBySession.get(r.session.id) ?? [];
			const sheet = sheets.get(r.session.pricingSchemeId);
			const tutorPrice = sheet ? tutorPriceNow(r.session, bookings, sheet) : null;
			const final =
				r.booking.finalPriceCents ??
				(tutorPrice === null
					? r.booking.priceCapCents
					: Math.min(r.booking.priceCapCents, tutorPrice));
			return {
				id: r.session.id,
				topicTitle: r.topicTitle,
				courseLabel: r.courseLabel,
				with: r.tutorName,
				startsAt: r.session.startsAt.toISOString(),
				durationMinutes: Math.round(
					(r.session.endsAt.getTime() - r.session.startsAt.getTime()) / 60000
				),
				where: where(r.session),
				phase: sessionPhase(r.session, now),
				group: { taken: seatsHeld(bookings, now), capacity: r.session.capacity },
				priceCents: sheet ? withBookingFee(final, sheet.studentFeeBps) : null
			};
		};
		const isUpcoming = (r: (typeof rows)[number]) => r.session.endsAt > now;
		return {
			role: 'student' as const,
			timeZone: profile?.timezone ?? DEFAULT_TIME_ZONE,
			upcoming: rows.filter(isUpcoming).map(shape),
			past: rows.filter((r) => !isUpcoming(r)).map(shape)
		};
	}

	if (user.role === TUTOR_ACCOUNT_TYPE) {
		const [profile, upcoming, past] = await Promise.all([
			Tutor.getProfile({ userId: user.id }),
			Session.listForTutor({ tutorId: user.id, when: 'upcoming', now }),
			Session.listForTutor({ tutorId: user.id, when: 'past', now })
		]);
		const all = [...upcoming, ...past];
		const [bookingsBySession, sheets] = await Promise.all([
			Booking.listForSessions({ sessionIds: all.map((s) => s.id) }),
			Pricing.sheetsForSchemes({ schemeIds: all.map((s) => s.pricingSchemeId) })
		]);

		const shape = (s: (typeof all)[number]) => {
			const bookings = bookingsBySession.get(s.id) ?? [];
			const sheet = sheets.get(s.pricingSchemeId);
			const tutorPrice = sheet ? tutorPriceNow(s, bookings, sheet) : null;
			const confirmed = bookings.filter((b) =>
				['confirmed', 'attended', 'no_show'].includes(b.status)
			);
			return {
				id: s.id,
				topicTitle: s.topicTitle,
				courseLabel: s.courseLabel,
				with: confirmed.map((b) => b.studentName).join(', ') || 'No students',
				startsAt: s.startsAt.toISOString(),
				durationMinutes: s.durationMinutes,
				where: where(s),
				phase: sessionPhase(s, now),
				group: { taken: seatsHeld(bookings, now), capacity: s.capacity },
				/** What the tutor earns at today's group size, after the platform fee. */
				priceCents:
					sheet && s.status !== 'cancelled'
						? confirmed.reduce((sum, b) => {
								const final =
									b.finalPriceCents ??
									(tutorPrice === null ? b.priceCapCents : Math.min(b.priceCapCents, tutorPrice));
								return sum + splitCharge(final, sheet).tutorPayoutCents;
							}, 0)
						: null
			};
		};
		return {
			role: 'tutor' as const,
			timeZone: profile?.timezone ?? DEFAULT_TIME_ZONE,
			upcoming: upcoming.map(shape),
			past: past.map(shape)
		};
	}

	return { role: 'other' as const, timeZone: DEFAULT_TIME_ZONE, upcoming: [], past: [] };
};
