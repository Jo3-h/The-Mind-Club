/**
 * A SMALL sample curriculum so dev has something to match on. Your real curriculum seed replaces
 * and extends this; both upsert on `key`, so they can coexist.
 *
 * Shows the three shapes that matter:
 *   - a national junior course (state = null)
 *   - state-specific senior courses
 *   - topics shared across states (SA 11/12 Methods and VIC 11 Methods) for demand pooling
 * Chapter titles are generic placeholders, not taken from a specific textbook.
 */

export const SAMPLE_SUBJECTS = [
	{ key: 'mathematics', name: 'Mathematics', sortOrder: 1 },
	{ key: 'chemistry', name: 'Chemistry', sortOrder: 2 }
] as const;

export const SAMPLE_TOPICS = [
	// Year 10 maths
	{ key: 'maths-linear-relations', subject: 'mathematics', title: 'Linear relations' },
	{ key: 'maths-simultaneous-equations', subject: 'mathematics', title: 'Simultaneous equations' },
	{ key: 'maths-quadratic-expressions', subject: 'mathematics', title: 'Quadratic expressions' },
	{ key: 'maths-quadratic-equations', subject: 'mathematics', title: 'Quadratic equations' },
	{ key: 'maths-trigonometry-intro', subject: 'mathematics', title: 'Trigonometry' },
	{ key: 'maths-probability-intro', subject: 'mathematics', title: 'Probability' },
	// Methods (shared across states)
	{ key: 'maths-functions-graphs', subject: 'mathematics', title: 'Functions and graphs' },
	{ key: 'maths-polynomials', subject: 'mathematics', title: 'Polynomials' },
	{ key: 'maths-exponentials-logs', subject: 'mathematics', title: 'Exponentials and logarithms' },
	{
		key: 'maths-differentiation-intro',
		subject: 'mathematics',
		title: 'Introduction to differentiation'
	},
	{
		key: 'maths-differentiation-applications',
		subject: 'mathematics',
		title: 'Applications of differentiation'
	},
	{ key: 'maths-integration-intro', subject: 'mathematics', title: 'Introduction to integration' },
	{
		key: 'maths-integration-applications',
		subject: 'mathematics',
		title: 'Applications of integration'
	},
	{
		key: 'maths-discrete-random-variables',
		subject: 'mathematics',
		title: 'Discrete random variables'
	},
	{ key: 'maths-normal-distribution', subject: 'mathematics', title: 'The normal distribution' },
	// Chemistry
	{ key: 'chem-atomic-structure', subject: 'chemistry', title: 'Atomic structure' },
	{ key: 'chem-bonding', subject: 'chemistry', title: 'Bonding and structure' },
	{ key: 'chem-stoichiometry', subject: 'chemistry', title: 'Stoichiometry' }
] as const;

export type TopicKey = (typeof SAMPLE_TOPICS)[number]['key'];

export const SAMPLE_COURSES: {
	key: string;
	subject: string;
	yearLevel: number;
	state: 'SA' | 'VIC' | null;
	name: string;
	topics: TopicKey[]; // in chapter order
}[] = [
	{
		key: 'au-10-maths',
		subject: 'mathematics',
		yearLevel: 10,
		state: null,
		name: 'Mathematics',
		topics: [
			'maths-linear-relations',
			'maths-simultaneous-equations',
			'maths-quadratic-expressions',
			'maths-quadratic-equations',
			'maths-trigonometry-intro',
			'maths-probability-intro'
		]
	},
	{
		key: 'sa-11-methods',
		subject: 'mathematics',
		yearLevel: 11,
		state: 'SA',
		name: 'Mathematical Methods',
		topics: [
			'maths-functions-graphs',
			'maths-polynomials',
			'maths-differentiation-intro',
			'maths-differentiation-applications'
		]
	},
	{
		key: 'sa-12-methods',
		subject: 'mathematics',
		yearLevel: 12,
		state: 'SA',
		name: 'Mathematical Methods',
		topics: [
			'maths-exponentials-logs',
			'maths-integration-intro',
			'maths-integration-applications',
			'maths-discrete-random-variables',
			'maths-normal-distribution'
		]
	},
	{
		key: 'vic-11-methods',
		subject: 'mathematics',
		yearLevel: 11,
		state: 'VIC',
		name: 'Mathematical Methods',
		// shares topics with SA 11 AND SA 12: different chapter numbers, same topic rows
		topics: [
			'maths-functions-graphs',
			'maths-polynomials',
			'maths-exponentials-logs',
			'maths-differentiation-intro'
		]
	},
	{
		key: 'sa-11-chemistry',
		subject: 'chemistry',
		yearLevel: 11,
		state: 'SA',
		name: 'Chemistry',
		topics: ['chem-atomic-structure', 'chem-bonding', 'chem-stoichiometry']
	}
];

/** Approximate centroids, enough for radius-matching in dev. */
export const SAMPLE_POSTCODES = [
	{ postcode: '5000', suburb: 'Adelaide', state: 'SA', lat: -34.9285, lng: 138.6007 },
	{ postcode: '5061', suburb: 'Unley', state: 'SA', lat: -34.95, lng: 138.607 },
	{ postcode: '5067', suburb: 'Norwood', state: 'SA', lat: -34.9214, lng: 138.6305 },
	{ postcode: '5082', suburb: 'Prospect', state: 'SA', lat: -34.8833, lng: 138.5944 },
	{ postcode: '3000', suburb: 'Melbourne', state: 'VIC', lat: -37.8136, lng: 144.9631 },
	{ postcode: '3121', suburb: 'Richmond', state: 'VIC', lat: -37.823, lng: 145.0 }
] as const;
