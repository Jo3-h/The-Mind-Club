import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { JOIN_OPENS_MINUTES_BEFORE } from '$lib/constants/sessions';
import { SessionIdSchema, isAllowedMeetingUrl } from '$lib/schemas/forms/booking';
import { Booking } from '$lib/server/repositories/bookings';
import { Session } from '$lib/server/repositories/sessions';

/**
 * The Join button for online sessions. Students never see the raw meeting link: this checks
 * they're the tutor or a confirmed student, that it's time, then redirects to the room.
 * Swapping to a platform-hosted provider later only changes this handler.
 *
 * NB: +server.ts files are NOT covered by (protected)/+layout.server.ts, so auth is checked here.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const id = SessionIdSchema.safeParse(params.sessionId);
	if (!id.success) error(404, 'Session not found');
	const back = `/sessions/${id.data}`;
	if (!locals.user) redirect(303, `/login?redirectTo=${encodeURIComponent(`${back}/join`)}`);

	const session = await Session.getDetail({ id: id.data });
	if (!session || session.locationType !== 'online') error(404, 'Session not found');

	const isTutor = session.tutorId === locals.user.id;
	if (!isTutor) {
		const booking = await Booking.findLive({ sessionId: session.id, studentId: locals.user.id });
		// same response as a missing session: don't confirm that private sessions exist
		if (booking?.status !== 'confirmed') error(404, 'Session not found');
	}

	const now = Date.now();
	const opensAt = session.startsAt.getTime() - JOIN_OPENS_MINUTES_BEFORE * 60000;
	if (session.status !== 'scheduled' || now < opensAt || now >= session.endsAt.getTime()) {
		redirect(303, back);
	}

	const url = await Session.meetingUrl({ id: session.id });
	// re-checked here too, in case a link got into the DB some other way
	if (!url || !isAllowedMeetingUrl(url)) redirect(303, back);
	redirect(303, url);
};
