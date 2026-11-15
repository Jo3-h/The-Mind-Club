import { pgEnum } from 'drizzle-orm/pg-core';

/*
 * Postgres enums. Adding a value later is a cheap, safe migration (ALTER TYPE … ADD VALUE).
 * Removing or renaming one is not — so only put values here you're confident in.
 */

export const auState = pgEnum('au_state', ['SA', 'NSW', 'VIC', 'QLD', 'WA', 'TAS', 'ACT', 'NT']);

// ---- profiles ----
export const tutorStatus = pgEnum('tutor_status', [
	'onboarding', // signed up, onboarding not finished
	'active', // bookable (see bookability rule in tutor-profiles.ts)
	'paused', // tutor hid themselves
	'suspended' // platform hid them
]);

export const wwccStatus = pgEnum('wwcc_status', [
	'not_provided',
	'pending',
	'verified',
	'rejected',
	'expired'
]);

export const teachingMode = pgEnum('teaching_mode', ['online', 'in_person', 'both']);
export const deliveryPreference = pgEnum('delivery_preference', ['online', 'in_person', 'either']);
export const groupPreference = pgEnum('group_preference', ['any', 'small', 'one_on_one']);

// ---- availability ----
export const availabilityExceptionKind = pgEnum('availability_exception_kind', [
	'blocked', // e.g. holiday, sick day — removes time
	'extra' // one-off extra time outside the weekly pattern
]);

// ---- sessions ----
export const locationType = pgEnum('location_type', [
	'online',
	'tutor_venue', // tutor's own place/office
	'public_venue', // library, café
	'student_home' // never joinable by other students
]);

export const sessionVisibility = pgEnum('session_visibility', [
	'open', // other students can discover and join
	'private' // only the creator (and invitees, later)
]);

export const sessionStatus = pgEnum('session_status', ['scheduled', 'completed', 'cancelled']);

export const seriesStatus = pgEnum('series_status', ['active', 'ended']);

// ---- bookings & money ----
export const bookingStatus = pgEnum('booking_status', [
	'pending', // seat held while payment is set up; expires at bookings.expires_at
	'confirmed', // seat is theirs
	'cancelled',
	'attended', // session done, student was there
	'no_show' // session done, student wasn't there
]);

export const paymentStatus = pgEnum('payment_status', [
	'requires_action', // waiting on the student (card entry, 3DS)
	'card_saved', // payment method saved for a later charge (booking > ~7 days out)
	'authorized', // hold placed, not yet captured
	'captured', // money taken
	'partially_refunded',
	'refunded',
	'cancelled', // hold released / intent cancelled
	'failed'
]);
