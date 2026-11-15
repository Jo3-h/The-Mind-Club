import type { DeliveryPreference, GroupPreference } from '$lib/types/onboarding';
import { GROUP_SIZE } from './sessions';
import type { LengthConstraint } from './shared';

export const DAYS = [
	{ value: 1, short: 'Mon', long: 'Monday' },
	{ value: 2, short: 'Tue', long: 'Tuesday' },
	{ value: 3, short: 'Wed', long: 'Wednesday' },
	{ value: 4, short: 'Thu', long: 'Thursday' },
	{ value: 5, short: 'Fri', long: 'Friday' },
	{ value: 6, short: 'Sat', long: 'Saturday' },
	{ value: 7, short: 'Sun', long: 'Sunday' }
] as const;

/** Availability grid range and resolution. */
export const GRID_START = 7 * 60; // 7:00am
export const GRID_END = 22 * 60; // 10:00pm
export const GRID_STEP = 30; // minutes per cell

/** Tutor max group size limits come from the session rules, so onboarding and booking agree. */
export const GROUP_SIZE_MIN = GROUP_SIZE.MIN;
export const GROUP_SIZE_MAX = GROUP_SIZE.MAX;
export const GROUP_SIZE_DEFAULT = GROUP_SIZE.DEFAULT;

export const TRAVEL_RADII = [5, 10, 15, 25] as const;

export const DELIVERY_PREFERENCES: { value: DeliveryPreference; label: string }[] = [
	{ value: 'online', label: 'Online' },
	{ value: 'in_person', label: 'In person' },
	{ value: 'either', label: 'Either' }
];

export const GROUP_PREFERENCES: { value: GroupPreference; label: string; hint: string }[] = [
	{ value: 'any', label: 'Any group', hint: 'Cheapest — bigger groups cost less each' },
	{ value: 'small', label: 'Small groups', hint: '2–3 students' },
	{ value: 'one_on_one', label: '1:1 only', hint: 'Just you and the tutor' }
];

/** Which step each field lives on, so server errors can send the user back to the right step. */
export const STUDENT_FIELD_STEP: Record<string, number> = {
	yearLevel: 2,
	state: 2,
	school: 2,
	postcode: 4,
	topicIds: 3,
	availability: 4,
	deliveryPreference: 4,
	groupPreference: 4
};

export const TUTOR_FIELD_STEP: Record<string, number> = {
	headline: 2,
	bio: 2,
	state: 2,
	wwccNumber: 2,
	topicIds: 3,
	maxGroupSize: 4,
	teachingMode: 4,
	postcode: 4,
	travelRadiusKm: 4,
	baseRate: 4,
	availability: 5
};

// ---- field limits (shared by the Zod schemas and the form inputs) ----

export const HEADLINE_LENGTH: LengthConstraint = Object.freeze({ MIN: 1, MAX: 80 });
export const BIO_LENGTH: LengthConstraint = Object.freeze({ MIN: 1, MAX: 600 });
export const SCHOOL_LENGTH: LengthConstraint = Object.freeze({ MIN: 0, MAX: 120 });
export const WWCC_NUMBER_LENGTH: LengthConstraint = Object.freeze({ MIN: 0, MAX: 40 });

/** How many chapters one person can pick. */
export const TOPIC_SELECTION = Object.freeze({ MIN: 1, MAX: 500 });
/** Upper bound on submitted windows: one per half-hour cell across the week. */
export const AVAILABILITY_WINDOWS_MAX = 7 * ((GRID_END - GRID_START) / GRID_STEP);
