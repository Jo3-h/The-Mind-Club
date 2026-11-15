// Data contract between the onboarding UI and the server.
// The front-end only reads these shapes; load functions/actions must provide them.

/** A weekly window in the profile's local time. Minutes from midnight, end exclusive. */
export type AvailabilityWindow = {
	day: number; // 1 = Monday … 7 = Sunday (ISO)
	start: number; // e.g. 930 = 15:30
	end: number;
};

export type CurriculumTopic = {
	id: string;
	chapter: number;
	title: string;
};

/**
 * One pickable block of chapters: a subject at a year level,
 * optionally a state-specific senior course.
 * state === null means the list applies nationally (e.g. Year 10).
 */
export type CurriculumGroup = {
	key: string;
	subject: string;
	yearLevel: number;
	course: string | null;
	state: string | null;
	topics: CurriculumTopic[];
};

export type DeliveryPreference = 'online' | 'in_person' | 'either';
export type GroupPreference = 'any' | 'small' | 'one_on_one';

/** What `form` looks like when the action returns fail(400, …). */
export type OnboardingFormResult = {
	values?: Record<string, string | string[] | undefined>;
	fieldErrors?: Record<string, string | undefined>;
};

// ---- Matches page ----

export type OpenSessionMatch = {
	id: string;
	tutorName: string;
	topicTitle: string;
	subjectLabel: string; // e.g. "Year 11 Mathematical Methods"
	startsAt: string; // ISO
	durationMinutes: number;
	joined: number;
	capacity: number;
	locationType: 'online' | 'in_person';
	suburb?: string | null;
	/** cents, what each student pays right now */
	pricePerStudent: number;
	/** cents, what each student would pay if this student joins */
	priceIfYouJoin: number;
};

export type TutorMatch = {
	id: string;
	name: string;
	headline: string;
	avatarUrl?: string | null;
	coveredTopics: string[]; // titles of the student's topics this tutor teaches
	totalTopics: number; // how many topics the student asked for
	overlaps: AvailabilityWindow[]; // shared free time, student's local time
	teachingMode: 'online' | 'in_person' | 'both';
	maxGroupSize: number;
	openSessionCount: number;
	/** cents, cheapest per-student price at a full group, if known */
	fromPricePerStudent?: number | null;
};

export type Recommendations = {
	openSessions: OpenSessionMatch[];
	tutors: TutorMatch[];
};
