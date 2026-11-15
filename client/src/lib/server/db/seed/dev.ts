/**
 * Development seed: a small, realistic marketplace that exercises every table and edge case.
 *
 * Re-runnable. Each run:
 *   1. upserts the sample curriculum, postcodes and pricing scheme (never deletes them)
 *   2. deletes everything owned by previous seed users (emails @seed.mindclub.test)
 *   3. recreates users, profiles, availability, sessions, bookings and payments
 * Your own dev account and anything it created are left alone.
 *
 * Every seed user can sign in with email + SEED_PASSWORD (needs emailAndPassword enabled in
 * Better Auth). Session times are relative to today, so the data never goes stale.
 */
import { randomUUID } from 'node:crypto';
import { eq, inArray, like, or, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { hashPassword } from 'better-auth/crypto';
import * as schema from '../schema';
import {
	SAMPLE_COURSES,
	SAMPLE_POSTCODES,
	SAMPLE_SUBJECTS,
	SAMPLE_TOPICS,
	type TopicKey
} from './curriculum-sample';
import { hm, occurrence, ymdString, zoned } from './time';
import { splitCharge } from '../../domain/feeSplit';
import { DEFAULT_PLATFORM_FEE_BPS, DEFAULT_STUDENT_FEE_BPS } from '../../../constants/sessions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = PgDatabase<PgQueryResultHKT, typeof schema, any>;
type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];

export const SEED_EMAIL_DOMAIN = 'seed.mindclub.test';
export const SEED_PASSWORD = 'mindclub-dev-123';

const ADL = 'Australia/Adelaide';
const MEL = 'Australia/Melbourne';
// a new name (and later active_from) so an older seed scheme, if present, is superseded, not edited
const SEED_SCHEME_NAME = 'Seed: launch pricing (5% + 5%)';
const TIERS = [10000, 7000, 5500, 4750, 4200, 3800]; // group size 1…6, basis points
const FEES = { studentFeeBps: DEFAULT_STUDENT_FEE_BPS, platformFeeBps: DEFAULT_PLATFORM_FEE_BPS };

/** per-student TUTOR price (before the booking fee) at a given group size, in cents */
function priceFor(baseRateCents: number, durationMin: number, groupSize: number) {
	const bps = TIERS[Math.min(groupSize, TIERS.length) - 1];
	return Math.round((baseRateCents * durationMin * bps) / (60 * 10000));
}

// ───────────────────────────── people ─────────────────────────────

type TutorSeed = {
	id: string;
	name: string;
	profile: Omit<typeof schema.tutorProfiles.$inferInsert, 'userId'>;
	courses: string[]; // course keys → all their topics
	availability: [weekday: number, start: number, end: number][];
};

type StudentSeed = {
	id: string;
	name: string;
	yearLevel: number | null;
	profile: Omit<typeof schema.studentProfiles.$inferInsert, 'userId' | 'graduationYear'>;
	topics: { key: TopicKey; neededInDays?: number; notify?: boolean }[];
	availability: [weekday: number, start: number, end: number][];
};

const done = new Date(); // onboarding completed "now" for the purposes of the seed

const TUTORS: TutorSeed[] = [
	{
		// The workhorse: SA Methods 11 & 12, online + in person, recurring series, every session type.
		id: 'seed_tutor_priya',
		name: 'Priya Natarajan',
		profile: {
			status: 'active',
			headline: 'Maths Methods tutor · 99.6 ATAR · 6 years tutoring',
			bio: 'I tutor SACE Mathematical Methods in small groups. Sessions are worked examples first, then exam-style questions, so you leave knowing how to answer them yourself.',
			state: 'SA',
			timezone: ADL,
			teachingMode: 'both',
			postcode: '5067',
			travelRadiusKm: 10,
			maxGroupSize: 4,
			baseRateCents: 6500,
			wwccNumber: 'DHS-1234567',
			wwccState: 'SA',
			wwccStatus: 'verified',
			wwccVerifiedAt: done,
			wwccExpiresAt: new Date(Date.now() + 3 * 365 * 864e5),
			stripeAccountId: 'acct_seed_priya',
			stripeDetailsSubmitted: true,
			stripeChargesEnabled: true,
			stripePayoutsEnabled: true,
			onboardingCompletedAt: done
		},
		courses: ['sa-11-methods', 'sa-12-methods'],
		availability: [
			[1, hm(15, 30), hm(19)],
			[2, hm(15, 30), hm(19)],
			[3, hm(15, 30), hm(19)],
			[4, hm(15, 30), hm(19)],
			[6, hm(9), hm(13)]
		]
	},
	{
		// Online-only, big groups, Year 10 + Year 11.
		id: 'seed_tutor_liam',
		name: "Liam O'Connor",
		profile: {
			status: 'active',
			headline: 'Year 10 & 11 maths, online only',
			bio: 'Engineering student at Adelaide Uni. I run relaxed online groups for Year 10 maths and Year 11 Methods, with lots of practice questions and a shared whiteboard.',
			state: 'SA',
			timezone: ADL,
			teachingMode: 'online',
			maxGroupSize: 6,
			baseRateCents: 5500,
			wwccNumber: 'DHS-7654321',
			wwccState: 'SA',
			wwccStatus: 'verified',
			wwccVerifiedAt: done,
			wwccExpiresAt: new Date(Date.now() + 2 * 365 * 864e5),
			stripeAccountId: 'acct_seed_liam',
			stripeDetailsSubmitted: true,
			stripeChargesEnabled: true,
			stripePayoutsEnabled: true,
			onboardingCompletedAt: done
		},
		courses: ['au-10-maths', 'sa-11-methods'],
		availability: [
			[1, hm(16), hm(20)],
			[3, hm(16), hm(20)],
			[5, hm(16), hm(20)],
			[7, hm(10), hm(14)]
		]
	},
	{
		// Interstate: VIC, Melbourne timezone, in person. Shares topics with SA → pooled sessions.
		id: 'seed_tutor_mei',
		name: 'Mei Chen',
		profile: {
			status: 'active',
			headline: 'VCE Methods tutor in Richmond',
			bio: 'Former maths teacher. I run small in-person and online groups for VCE Mathematical Methods Units 1 & 2, focusing on functions and early calculus.',
			state: 'VIC',
			timezone: MEL,
			teachingMode: 'both',
			postcode: '3121',
			travelRadiusKm: 15,
			maxGroupSize: 3,
			baseRateCents: 7000,
			wwccNumber: 'VIC-00112233',
			wwccState: 'VIC',
			wwccStatus: 'verified',
			wwccVerifiedAt: done,
			wwccExpiresAt: new Date(Date.now() + 4 * 365 * 864e5),
			stripeAccountId: 'acct_seed_mei',
			stripeDetailsSubmitted: true,
			stripeChargesEnabled: true,
			stripePayoutsEnabled: true,
			onboardingCompletedAt: done
		},
		courses: ['vic-11-methods'],
		availability: [
			[2, hm(16), hm(19)],
			[4, hm(16), hm(19)],
			[6, hm(10), hm(14)]
		]
	},
	{
		// Edge case: onboarding done but NOT bookable (WWCC pending, Stripe unfinished).
		// Only chemistry tutor, so chemistry students see no matches.
		id: 'seed_tutor_grace',
		name: 'Grace Kim',
		profile: {
			status: 'active',
			headline: 'SACE Chemistry, Stage 1',
			bio: 'Chemistry honours graduate. I explain the why behind each reaction and build up to exam questions step by step.',
			state: 'SA',
			timezone: ADL,
			teachingMode: 'online',
			maxGroupSize: 5,
			baseRateCents: 6000,
			wwccNumber: 'DHS-5550001',
			wwccState: 'SA',
			wwccStatus: 'pending',
			stripeAccountId: 'acct_seed_grace',
			stripeDetailsSubmitted: false,
			onboardingCompletedAt: done
		},
		courses: ['sa-11-chemistry'],
		availability: [
			[2, hm(17), hm(20)],
			[4, hm(17), hm(20)]
		]
	},
	{
		// Edge case: signed up, never finished onboarding. No topics, no availability.
		id: 'seed_tutor_sam',
		name: 'Sam Whitaker',
		profile: { status: 'onboarding', timezone: ADL },
		courses: [],
		availability: []
	}
];

const STUDENTS: StudentSeed[] = [
	{
		id: 'seed_student_ava',
		name: 'Ava Thompson',
		yearLevel: 11,
		profile: {
			state: 'SA',
			timezone: ADL,
			postcode: '5061',
			school: 'Unley High School',
			deliveryPreference: 'either',
			groupPreference: 'any',
			onboardingCompletedAt: done
		},
		topics: [
			{ key: 'maths-functions-graphs' },
			{ key: 'maths-differentiation-intro', neededInDays: 14 },
			{ key: 'maths-differentiation-applications', neededInDays: 21 }
		],
		availability: [
			[1, hm(15, 30), hm(18)],
			[2, hm(15, 30), hm(18)],
			[3, hm(15, 30), hm(18)],
			[5, hm(15, 30), hm(18)]
		]
	},
	{
		id: 'seed_student_noah',
		name: 'Noah Patel',
		yearLevel: 11,
		profile: {
			state: 'SA',
			timezone: ADL,
			deliveryPreference: 'online',
			groupPreference: 'small',
			onboardingCompletedAt: done
		},
		topics: [
			{ key: 'maths-functions-graphs' },
			{ key: 'maths-polynomials' },
			{ key: 'maths-differentiation-intro' }
		],
		availability: [
			[1, hm(16), hm(19)],
			[2, hm(15, 30), hm(18)],
			[4, hm(15), hm(18)],
			[5, hm(16), hm(19)]
		]
	},
	{
		id: 'seed_student_isla',
		name: 'Isla Nguyen',
		yearLevel: 12,
		profile: {
			state: 'SA',
			timezone: ADL,
			postcode: '5000',
			school: 'Adelaide High School',
			deliveryPreference: 'in_person',
			groupPreference: 'any',
			onboardingCompletedAt: done
		},
		topics: [
			{ key: 'maths-integration-intro', neededInDays: 10 },
			{ key: 'maths-normal-distribution' }
		],
		availability: [
			[1, hm(15, 30), hm(18)],
			[6, hm(9), hm(12)]
		]
	},
	{
		id: 'seed_student_jack',
		name: 'Jack Wilson',
		yearLevel: 10,
		profile: {
			state: 'SA',
			timezone: ADL,
			deliveryPreference: 'online',
			groupPreference: 'any',
			onboardingCompletedAt: done
		},
		topics: [{ key: 'maths-quadratic-expressions' }, { key: 'maths-quadratic-equations' }],
		availability: [
			[1, hm(16), hm(19)],
			[3, hm(17), hm(20)]
		]
	},
	{
		// 1:1 only, wants the tutor to come to her home
		id: 'seed_student_zoe',
		name: 'Zoe Martin',
		yearLevel: 10,
		profile: {
			state: 'SA',
			timezone: ADL,
			postcode: '5067',
			deliveryPreference: 'in_person',
			groupPreference: 'one_on_one',
			onboardingCompletedAt: done
		},
		topics: [{ key: 'maths-quadratic-equations' }, { key: 'maths-trigonometry-intro' }],
		availability: [
			[1, hm(17), hm(19)],
			[4, hm(16, 30), hm(19)]
		]
	},
	{
		// interstate student pooled into SA tutor's online group
		id: 'seed_student_ethan',
		name: 'Ethan Brown',
		yearLevel: 11,
		profile: {
			state: 'VIC',
			timezone: MEL,
			deliveryPreference: 'online',
			groupPreference: 'any',
			onboardingCompletedAt: done
		},
		topics: [{ key: 'maths-functions-graphs' }, { key: 'maths-differentiation-applications' }],
		availability: [
			[3, hm(16), hm(19)],
			[4, hm(16), hm(18)]
		]
	},
	{
		id: 'seed_student_chloe',
		name: 'Chloe Davis',
		yearLevel: 11,
		profile: {
			state: 'VIC',
			timezone: MEL,
			postcode: '3121',
			deliveryPreference: 'in_person',
			groupPreference: 'small',
			onboardingCompletedAt: done
		},
		topics: [{ key: 'maths-exponentials-logs' }, { key: 'maths-polynomials' }],
		availability: [[6, hm(10), hm(13)]]
	},
	{
		// edge case: no bookable tutor teaches chemistry → empty matches + notify request
		id: 'seed_student_ruby',
		name: 'Ruby Lee',
		yearLevel: 11,
		profile: {
			state: 'SA',
			timezone: ADL,
			deliveryPreference: 'online',
			groupPreference: 'any',
			onboardingCompletedAt: done
		},
		topics: [
			{ key: 'chem-stoichiometry', notify: true },
			{ key: 'chem-bonding', notify: true }
		],
		availability: [[2, hm(17), hm(19)]]
	},
	{
		// edge case: signed up, onboarding unfinished
		id: 'seed_student_leo',
		name: 'Leo Garcia',
		yearLevel: null,
		profile: { timezone: ADL, groupPreference: 'any' },
		topics: [],
		availability: []
	}
];

const emailFor = (id: string) => `${id.replace(/^seed_(tutor|student)_/, '')}@${SEED_EMAIL_DOMAIN}`;

// ───────────────────────────── main ─────────────────────────────

export async function seedDev(db: DB) {
	const passwordHash = await hashPassword(SEED_PASSWORD);

	return db.transaction(async (tx) => {
		const ids = await seedReferenceData(tx);
		await wipePreviousSeed(tx);
		await seedPeople(tx, ids, passwordHash);
		const summary = await seedSessions(tx, ids);
		return summary;
	});
}

// ───────────────────────── reference data ─────────────────────────

async function seedReferenceData(tx: Tx) {
	const subjectRows = await tx
		.insert(schema.subjects)
		.values(SAMPLE_SUBJECTS.map((s) => ({ ...s })))
		.onConflictDoUpdate({ target: schema.subjects.key, set: { name: sql`excluded.name` } })
		.returning({ id: schema.subjects.id, key: schema.subjects.key });
	const subjectId = Object.fromEntries(subjectRows.map((r) => [r.key, r.id]));

	const topicRows = await tx
		.insert(schema.topics)
		.values(
			SAMPLE_TOPICS.map((t) => ({ key: t.key, title: t.title, subjectId: subjectId[t.subject] }))
		)
		.onConflictDoUpdate({ target: schema.topics.key, set: { title: sql`excluded.title` } })
		.returning({ id: schema.topics.id, key: schema.topics.key });
	const topicId = Object.fromEntries(topicRows.map((r) => [r.key, r.id])) as Record<
		TopicKey,
		string
	>;

	const courseRows = await tx
		.insert(schema.courses)
		.values(
			SAMPLE_COURSES.map((c, i) => ({
				key: c.key,
				subjectId: subjectId[c.subject],
				yearLevel: c.yearLevel,
				state: c.state,
				name: c.name,
				sortOrder: i
			}))
		)
		.onConflictDoUpdate({
			target: schema.courses.key,
			set: {
				name: sql`excluded.name`,
				yearLevel: sql`excluded.year_level`,
				state: sql`excluded.state`
			}
		})
		.returning({ id: schema.courses.id, key: schema.courses.key });
	const courseId = Object.fromEntries(courseRows.map((r) => [r.key, r.id]));

	await tx
		.insert(schema.courseTopics)
		.values(
			SAMPLE_COURSES.flatMap((c) =>
				c.topics.map((t, i) => ({
					courseId: courseId[c.key],
					topicId: topicId[t],
					chapterNumber: i + 1
				}))
			)
		)
		.onConflictDoUpdate({
			target: [schema.courseTopics.courseId, schema.courseTopics.topicId],
			set: { chapterNumber: sql`excluded.chapter_number` }
		});

	await tx
		.insert(schema.postcodes)
		.values(SAMPLE_POSTCODES.map((p) => ({ ...p })))
		.onConflictDoNothing();

	// pricing scheme: reuse the seed one if it exists (schemes are immutable once used)
	let [scheme] = await tx
		.select({ id: schema.pricingSchemes.id })
		.from(schema.pricingSchemes)
		.where(eq(schema.pricingSchemes.name, SEED_SCHEME_NAME));
	if (!scheme) {
		[scheme] = await tx
			.insert(schema.pricingSchemes)
			.values({
				name: SEED_SCHEME_NAME,
				platformFeeBps: FEES.platformFeeBps,
				studentFeeBps: FEES.studentFeeBps,
				activeFrom: new Date('2026-11-01T00:00:00Z')
			})
			.returning({ id: schema.pricingSchemes.id });
		await tx
			.insert(schema.pricingTiers)
			.values(
				TIERS.map((bps, i) => ({ schemeId: scheme.id, groupSize: i + 1, multiplierBps: bps }))
			);
	}

	return { topicId, courseId, schemeId: scheme.id };
}

// ───────────────────────── wipe previous seed ─────────────────────────

async function wipePreviousSeed(tx: Tx) {
	const seedUsers = await tx
		.select({ id: schema.user.id })
		.from(schema.user)
		.where(like(schema.user.email, `%@${SEED_EMAIL_DOMAIN}`));
	const userIds = seedUsers.map((u) => u.id);

	await tx.delete(schema.stripeEvents).where(like(schema.stripeEvents.id, 'evt_seed_%'));
	if (userIds.length === 0) return;

	const sessionIds = (
		await tx
			.select({ id: schema.tutoringSessions.id })
			.from(schema.tutoringSessions)
			.where(inArray(schema.tutoringSessions.tutorId, userIds))
	).map((s) => s.id);

	const bookingFilter = sessionIds.length
		? or(
				inArray(schema.bookings.studentId, userIds),
				inArray(schema.bookings.sessionId, sessionIds)
			)
		: inArray(schema.bookings.studentId, userIds);
	const bookingIds = (
		await tx.select({ id: schema.bookings.id }).from(schema.bookings).where(bookingFilter)
	).map((b) => b.id);

	if (bookingIds.length)
		await tx.delete(schema.payments).where(inArray(schema.payments.bookingId, bookingIds));
	await tx.delete(schema.payments).where(inArray(schema.payments.payerUserId, userIds));
	if (bookingIds.length)
		await tx.delete(schema.bookings).where(inArray(schema.bookings.id, bookingIds));
	if (sessionIds.length)
		await tx.delete(schema.tutoringSessions).where(inArray(schema.tutoringSessions.id, sessionIds));
	await tx.delete(schema.sessionSeries).where(inArray(schema.sessionSeries.tutorId, userIds));
	// sessions created by a seed user for a non-seed tutor: just unlink
	await tx
		.update(schema.tutoringSessions)
		.set({ createdByUserId: null })
		.where(inArray(schema.tutoringSessions.createdByUserId, userIds));

	// profiles, topics, availability, Better Auth accounts/sessions cascade from user
	await tx.delete(schema.user).where(inArray(schema.user.id, userIds));
}

// ───────────────────────────── people ─────────────────────────────

async function seedPeople(
	tx: Tx,
	ids: Awaited<ReturnType<typeof seedReferenceData>>,
	passwordHash: string
) {
	const now = new Date();
	const schoolYear = now.getFullYear(); // Australian school year = calendar year

	const users = [
		{
			id: 'seed_admin',
			name: 'Seed Admin',
			email: `admin@${SEED_EMAIL_DOMAIN}`,
			role: 'admin' as const
		},
		...TUTORS.map((t) => ({
			id: t.id,
			name: t.name,
			email: emailFor(t.id),
			role: 'tutor' as const
		})),
		...STUDENTS.map((s) => ({
			id: s.id,
			name: s.name,
			email: emailFor(s.id),
			role: 'student' as const
		}))
	];

	await tx
		.insert(schema.user)
		.values(users.map((u) => ({ ...u, emailVerified: true, createdAt: now, updatedAt: now })));
	await tx.insert(schema.account).values(
		users.map((u) => ({
			id: `seed_account_${u.id}`,
			accountId: u.id,
			providerId: 'credential',
			userId: u.id,
			password: passwordHash,
			createdAt: now,
			updatedAt: now
		}))
	);

	// tutors
	await tx.insert(schema.tutorProfiles).values(TUTORS.map((t) => ({ userId: t.id, ...t.profile })));
	const tutorTopicRows = TUTORS.flatMap((t) => {
		const keys = new Set(
			SAMPLE_COURSES.filter((c) => t.courses.includes(c.key)).flatMap((c) => c.topics)
		);
		return [...keys].map((k) => ({ tutorId: t.id, topicId: ids.topicId[k] }));
	});
	if (tutorTopicRows.length) await tx.insert(schema.tutorTopics).values(tutorTopicRows);

	// students
	await tx.insert(schema.studentProfiles).values(
		STUDENTS.map((s) => ({
			userId: s.id,
			...s.profile,
			graduationYear: s.yearLevel ? schoolYear + (12 - s.yearLevel) : null
		}))
	);
	const studentTopicRows = STUDENTS.flatMap((s) =>
		s.topics.map((t) => ({
			studentId: s.id,
			topicId: ids.topicId[t.key],
			neededBy: t.neededInDays
				? new Date(Date.now() + t.neededInDays * 864e5).toISOString().slice(0, 10)
				: null,
			notifyRequestedAt: t.notify ? now : null
		}))
	);
	if (studentTopicRows.length) await tx.insert(schema.studentTopics).values(studentTopicRows);

	// weekly availability (everyone)
	const windows = [...TUTORS, ...STUDENTS].flatMap((p) =>
		p.availability.map(([weekday, startMinute, endMinute]) => ({
			userId: p.id,
			weekday,
			startMinute,
			endMinute
		}))
	);
	await tx.insert(schema.weeklyAvailability).values(windows);

	// exceptions: Priya away all of next-next Thursday; Liam adds a one-off Saturday morning
	const priyaAway = occurrence(4, 1, ADL);
	const liamExtra = occurrence(6, 0, ADL);
	await tx.insert(schema.availabilityExceptions).values([
		{
			userId: 'seed_tutor_priya',
			kind: 'blocked',
			startsAt: zoned(priyaAway, 0, ADL),
			endsAt: zoned(priyaAway, hm(24), ADL),
			note: 'Uni exam'
		},
		{
			userId: 'seed_tutor_liam',
			kind: 'extra',
			startsAt: zoned(liamExtra, hm(9), ADL),
			endsAt: zoned(liamExtra, hm(12), ADL),
			note: 'Extra exam-prep morning'
		}
	]);
}

// ───────────────────────── sessions, bookings, payments ─────────────────────────

type BookingSpec = {
	student: string;
	status: (typeof schema.bookingStatus.enumValues)[number];
	/** group size at the moment they joined (sets their price cap) */
	joinedAtSize: number;
	payment?: PaymentSpec | PaymentSpec[];
	cancelledBy?: string;
	cancelReason?: string;
	pendingExpiresInMin?: number;
};
type PaymentSpec =
	| (typeof schema.paymentStatus.enumValues)[number]
	| { status: 'failed'; code: string; message: string };

type SessionSpec = {
	label: string;
	tutor: string;
	tz: string;
	date: { y: number; m: number; d: number };
	start: number;
	duration: number;
	topic: TopicKey;
	course: string;
	location: (typeof schema.locationType.enumValues)[number];
	visibility?: 'open' | 'private';
	capacity: number;
	status?: 'scheduled' | 'completed' | 'cancelled';
	seriesId?: string;
	bookings: BookingSpec[];
	cancelReason?: string;
};

const RATE: Record<string, number> = {
	seed_tutor_priya: 6500,
	seed_tutor_liam: 5500,
	seed_tutor_mei: 7000
};
const STRIPE_ACCT: Record<string, string> = {
	seed_tutor_priya: 'acct_seed_priya',
	seed_tutor_liam: 'acct_seed_liam',
	seed_tutor_mei: 'acct_seed_mei'
};

const PLACE: Record<string, { suburb: string; postcode: string; addressLine?: string }> = {
	norwoodLibrary: {
		suburb: 'Norwood',
		postcode: '5067',
		addressLine: 'Norwood Library, study room 2'
	},
	cityLibrary: {
		suburb: 'Adelaide',
		postcode: '5000',
		addressLine: 'State Library of SA, group room B'
	},
	zoeHome: {
		suburb: 'Norwood',
		postcode: '5067',
		addressLine: 'Student home (shared after booking)'
	},
	meiStudio: { suburb: 'Richmond', postcode: '3121', addressLine: "Mei's study, Swan St" }
};

async function seedSessions(tx: Tx, ids: Awaited<ReturnType<typeof seedReferenceData>>) {
	const priyaSeriesId = randomUUID();
	const seriesStart = occurrence(2, 0, ADL); // next Tuesday

	await tx.insert(schema.sessionSeries).values({
		id: priyaSeriesId,
		tutorId: 'seed_tutor_priya',
		weekday: 2,
		startMinute: hm(16),
		durationMinutes: 60,
		timezone: ADL,
		startsOn: ymdString(seriesStart),
		capacity: 4,
		visibility: 'open',
		locationType: 'online'
	});

	const specs: SessionSpec[] = [
		// ── Priya ──
		{
			label: 'Completed in-person group (attended, attended, no-show)',
			tutor: 'seed_tutor_priya',
			tz: ADL,
			date: occurrence(1, -2, ADL),
			start: hm(16),
			duration: 60,
			topic: 'maths-differentiation-intro',
			course: 'sa-11-methods',
			location: 'public_venue',
			capacity: 4,
			status: 'completed',
			bookings: [
				{ student: 'seed_student_ava', status: 'attended', joinedAtSize: 1, payment: 'captured' },
				{ student: 'seed_student_noah', status: 'attended', joinedAtSize: 2, payment: 'captured' },
				{ student: 'seed_student_isla', status: 'no_show', joinedAtSize: 3, payment: 'captured' }
			]
		},
		{
			label: 'Open online group, 2 of 4 seats, includes an interstate student and a cancellation',
			tutor: 'seed_tutor_priya',
			tz: ADL,
			date: occurrence(3, 0, ADL),
			start: hm(16, 30),
			duration: 60,
			topic: 'maths-differentiation-applications',
			course: 'sa-11-methods',
			location: 'online',
			capacity: 4,
			bookings: [
				{
					student: 'seed_student_ava',
					status: 'confirmed',
					joinedAtSize: 1,
					payment: 'authorized'
				},
				{
					student: 'seed_student_noah',
					status: 'cancelled',
					joinedAtSize: 2,
					payment: 'cancelled',
					cancelledBy: 'seed_student_noah',
					cancelReason: 'Clash with sport'
				},
				{
					student: 'seed_student_ethan',
					status: 'confirmed',
					joinedAtSize: 2,
					payment: 'authorized'
				}
			]
		},
		{
			label: "Private 1:1 at the student's home",
			tutor: 'seed_tutor_priya',
			tz: ADL,
			date: occurrence(1, 0, ADL),
			start: hm(17, 30),
			duration: 60,
			topic: 'maths-functions-graphs',
			course: 'sa-11-methods',
			location: 'student_home',
			visibility: 'private',
			capacity: 1,
			bookings: [
				{ student: 'seed_student_zoe', status: 'confirmed', joinedAtSize: 1, payment: 'authorized' }
			]
		},
		{
			label: 'Open Year 12 Saturday group, 1 of 4 (failed card, then retry succeeded)',
			tutor: 'seed_tutor_priya',
			tz: ADL,
			date: occurrence(6, 0, ADL),
			start: hm(10),
			duration: 90,
			topic: 'maths-integration-intro',
			course: 'sa-12-methods',
			location: 'public_venue',
			capacity: 4,
			bookings: [
				{
					student: 'seed_student_isla',
					status: 'confirmed',
					joinedAtSize: 1,
					payment: [
						{ status: 'failed', code: 'card_declined', message: 'Your card was declined.' },
						'authorized'
					]
				}
			]
		},
		// Priya's weekly series: 3 generated weeks, same two students each week
		...[0, 1, 2].map((week, i): SessionSpec => ({
			label: `Weekly series, week ${week + 1}`,
			tutor: 'seed_tutor_priya',
			tz: ADL,
			date: occurrence(2, week, ADL),
			start: hm(16),
			duration: 60,
			topic: (
				['maths-functions-graphs', 'maths-polynomials', 'maths-differentiation-intro'] as const
			)[i],
			course: 'sa-11-methods',
			location: 'online',
			capacity: 4,
			seriesId: priyaSeriesId,
			bookings: [
				// within ~7 days → card hold; further out → card saved, charged later
				{
					student: 'seed_student_ava',
					status: 'confirmed',
					joinedAtSize: 1,
					payment: week === 0 ? 'authorized' : 'card_saved'
				},
				{
					student: 'seed_student_noah',
					status: 'confirmed',
					joinedAtSize: 2,
					payment: week === 0 ? 'authorized' : 'card_saved'
				}
			]
		})),

		// ── Liam ──
		{
			label: 'Full online group (2 of 2)',
			tutor: 'seed_tutor_liam',
			tz: ADL,
			date: occurrence(1, 0, ADL),
			start: hm(16),
			duration: 60,
			topic: 'maths-quadratic-equations',
			course: 'au-10-maths',
			location: 'online',
			capacity: 2,
			bookings: [
				{
					student: 'seed_student_jack',
					status: 'confirmed',
					joinedAtSize: 1,
					payment: 'authorized'
				},
				{ student: 'seed_student_zoe', status: 'confirmed', joinedAtSize: 2, payment: 'authorized' }
			]
		},
		{
			label: 'Session cancelled by the tutor',
			tutor: 'seed_tutor_liam',
			tz: ADL,
			date: occurrence(3, 0, ADL),
			start: hm(18),
			duration: 60,
			topic: 'maths-quadratic-expressions',
			course: 'au-10-maths',
			location: 'online',
			capacity: 6,
			status: 'cancelled',
			cancelReason: 'Tutor unwell',
			bookings: [
				{
					student: 'seed_student_jack',
					status: 'cancelled',
					joinedAtSize: 1,
					payment: 'cancelled',
					cancelledBy: 'seed_tutor_liam',
					cancelReason: 'Session cancelled by tutor'
				}
			]
		},
		{
			label: 'Open online group with one confirmed and one pending seat',
			tutor: 'seed_tutor_liam',
			tz: ADL,
			date: occurrence(5, 0, ADL),
			start: hm(16, 30),
			duration: 60,
			topic: 'maths-functions-graphs',
			course: 'sa-11-methods',
			location: 'online',
			capacity: 6,
			bookings: [
				{
					student: 'seed_student_noah',
					status: 'confirmed',
					joinedAtSize: 1,
					payment: 'authorized'
				},
				{
					student: 'seed_student_ava',
					status: 'pending',
					joinedAtSize: 2,
					payment: 'requires_action',
					pendingExpiresInMin: 15
				}
			]
		},

		// ── Mei (Melbourne time) ──
		{
			label: 'Cross-state pooled group: VIC tutor, VIC + SA students, same topic',
			tutor: 'seed_tutor_mei',
			tz: MEL,
			date: occurrence(4, 0, MEL),
			start: hm(16),
			duration: 60,
			topic: 'maths-functions-graphs',
			course: 'vic-11-methods',
			location: 'online',
			capacity: 3,
			bookings: [
				{
					student: 'seed_student_ethan',
					status: 'confirmed',
					joinedAtSize: 1,
					payment: 'authorized'
				},
				{
					student: 'seed_student_noah',
					status: 'confirmed',
					joinedAtSize: 2,
					payment: 'authorized'
				}
			]
		},
		{
			label: "In-person at the tutor's place, one pending booking",
			tutor: 'seed_tutor_mei',
			tz: MEL,
			date: occurrence(6, 0, MEL),
			start: hm(11),
			duration: 60,
			topic: 'maths-exponentials-logs',
			course: 'vic-11-methods',
			location: 'tutor_venue',
			capacity: 3,
			bookings: [
				{
					student: 'seed_student_chloe',
					status: 'pending',
					joinedAtSize: 1,
					payment: 'requires_action',
					pendingExpiresInMin: 15
				}
			]
		}
	];

	const placeFor = (s: SessionSpec) =>
		s.location === 'online'
			? {}
			: s.location === 'student_home'
				? PLACE.zoeHome
				: s.location === 'tutor_venue'
					? PLACE.meiStudio
					: s.course === 'sa-12-methods'
						? PLACE.cityLibrary
						: PLACE.norwoodLibrary;

	let paymentCount = 0;
	for (const s of specs) {
		const startsAt = zoned(s.date, s.start, s.tz);
		const endsAt = new Date(startsAt.getTime() + s.duration * 60000);
		const base = RATE[s.tutor];
		const status = s.status ?? 'scheduled';

		const [session] = await tx
			.insert(schema.tutoringSessions)
			.values({
				tutorId: s.tutor,
				seriesId: s.seriesId ?? null,
				topicId: ids.topicId[s.topic],
				courseId: ids.courseId[s.course],
				startsAt,
				endsAt,
				locationType: s.location,
				...placeFor(s),
				meetingUrl:
					s.location === 'online'
						? `https://meet.example.com/seed-${randomUUID().slice(0, 8)}`
						: null,
				capacity: s.capacity,
				visibility: s.visibility ?? 'open',
				baseRateCents: base,
				pricingSchemeId: ids.schemeId,
				status,
				createdByUserId: s.bookings[0]?.student ?? s.tutor,
				completedAt: status === 'completed' ? endsAt : null,
				cancelledAt: status === 'cancelled' ? new Date() : null,
				cancelReason: s.cancelReason ?? null
			})
			.returning({ id: schema.tutoringSessions.id });

		// final group size counts everyone who held a seat at the end
		const finalSize = s.bookings.filter((b) =>
			['confirmed', 'attended', 'no_show'].includes(b.status)
		).length;

		for (const b of s.bookings) {
			const cap = priceFor(base, s.duration, b.joinedAtSize);
			const final =
				status === 'completed' ? Math.min(cap, priceFor(base, s.duration, finalSize)) : null;
			const isCancelled = b.status === 'cancelled';

			const [booking] = await tx
				.insert(schema.bookings)
				.values({
					sessionId: session.id,
					studentId: b.student,
					status: b.status,
					expiresAt: b.pendingExpiresInMin
						? new Date(Date.now() + b.pendingExpiresInMin * 60000)
						: null,
					priceCapCents: cap,
					finalPriceCents: final,
					confirmedAt: b.status === 'pending' ? null : new Date(startsAt.getTime() - 3 * 864e5),
					cancelledAt: isCancelled ? new Date() : null,
					cancelledByUserId: b.cancelledBy ?? null,
					cancelReason: b.cancelReason ?? null
				})
				.returning({ id: schema.bookings.id });

			const payments = Array.isArray(b.payment) ? b.payment : b.payment ? [b.payment] : [];
			for (const p of payments) {
				const pStatus = typeof p === 'string' ? p : p.status;
				// cap / final are tutor prices; the card is charged what the student pays (fee included)
				const charge = splitCharge(final ?? cap, FEES);
				const captured = pStatus === 'captured' ? charge.studentPaysCents : null;
				const authorized = ['authorized', 'captured', 'cancelled'].includes(pStatus)
					? splitCharge(cap, FEES).studentPaysCents
					: null;
				paymentCount++;
				await tx.insert(schema.payments).values({
					bookingId: booking.id,
					payerUserId: b.student,
					status: pStatus,
					stripePaymentIntentId:
						pStatus === 'card_saved'
							? null
							: `pi_seed_${randomUUID().replace(/-/g, '').slice(0, 20)}`,
					stripeSetupIntentId:
						pStatus === 'card_saved'
							? `seti_seed_${randomUUID().replace(/-/g, '').slice(0, 20)}`
							: null,
					stripePaymentMethodId: pStatus === 'requires_action' ? null : 'pm_card_visa',
					stripeDestinationAccountId: STRIPE_ACCT[s.tutor],
					amountAuthorizedCents: authorized,
					amountCapturedCents: captured,
					applicationFeeCents: captured !== null ? charge.platformKeepsCents : null,
					failureCode: typeof p === 'object' ? p.code : null,
					failureMessage: typeof p === 'object' ? p.message : null,
					authorizedAt: authorized !== null ? new Date(startsAt.getTime() - 3 * 864e5) : null,
					capturedAt: captured !== null ? endsAt : null
				});
			}
		}
	}

	await tx.insert(schema.stripeEvents).values([
		{ id: 'evt_seed_account_updated_priya', type: 'account.updated', processedAt: new Date() },
		{
			id: 'evt_seed_payment_intent_succeeded',
			type: 'payment_intent.succeeded',
			processedAt: new Date()
		},
		{ id: 'evt_seed_unprocessed', type: 'payment_intent.payment_failed', processedAt: null }
	]);

	return {
		tutors: TUTORS.length,
		students: STUDENTS.length,
		sessions: specs.length,
		bookings: specs.reduce((n, s) => n + s.bookings.length, 0),
		payments: paymentCount,
		sessionLabels: specs.map((s) => s.label)
	};
}
