// Session, booking and fee rules. Pure values with no imports, so the domain layer, Zod schemas,
// UI and tsx scripts (seed) can all share them.

/**
 * Students in one session. 1 = a private 1:1 lesson. A tutor's max_group_size and every session's
 * capacity must sit inside this range (D7).
 */
export const GROUP_SIZE = Object.freeze({ MIN: 1, MAX: 6, DEFAULT: 4 });

/** A session stops taking joins and leaves this many hours before it starts (D1). */
export const LOCK_HOURS_BEFORE_START = 24;

/** Lengths a student can book, in minutes. The first is the default. */
export const SESSION_DURATIONS = [60, 90, 120] as const;
export type SessionDuration = (typeof SESSION_DURATIONS)[number];
export const DEFAULT_SESSION_MINUTES: SessionDuration = 60;

/** Start times are offered on this grid (minutes past local midnight). */
export const START_TIME_STEP_MINUTES = 30;

/** How far ahead a session can be booked. */
export const BOOKING_HORIZON_DAYS = 28;

/**
 * Fee defaults for new pricing schemes, in basis points (100 = 1%). The live values are on each
 * pricing_schemes row (and snapshotted by every session through its scheme); these only seed it.
 *   student fee: added on top of the tutor's price and shown INSIDE every price a student sees
 *   platform fee: taken out of the tutor's price before payout
 */
export const DEFAULT_STUDENT_FEE_BPS = 500;
export const DEFAULT_PLATFORM_FEE_BPS = 500;

/**
 * Bookability checks (WWCC verified, Stripe payouts on). OFF until payments exist, by the owner's
 * call for testing. Flip to true before launch: TutorDirectory derives `bookable` from this.
 */
export const BOOKING_REQUIRES_VERIFICATION = false;

// ---- where ----

/** Free-text public venue a student names ("Adelaide City Library, level 2"). */
export const VENUE_LENGTH = Object.freeze({ MIN: 3, MAX: 120 });

/** Labels for the DB location types, as students see them. */
export const LOCATION_LABELS = {
	online: 'Online',
	tutor_venue: "At the tutor's place",
	public_venue: 'A public place (library, café)',
	student_home: 'At my home (1:1 only)'
} as const;

// ---- online meetings ----

/**
 * Meeting links must be https on one of these hosts (or a subdomain, e.g. us02web.zoom.us).
 * Stops a link to an arbitrary site being handed to students through the Join button.
 */
export const MEETING_HOSTS = [
	'zoom.us',
	'meet.google.com',
	'teams.microsoft.com',
	'teams.live.com',
	'whereby.com'
] as const;

export const MEETING_URL_MAX_LENGTH = 500;

/** The Join button works from this many minutes before the start until the session ends. */
export const JOIN_OPENS_MINUTES_BEFORE = 15;
