import { and, asc, eq, isNull, or, type SQL } from 'drizzle-orm';
import { db } from '../db';
import { courses, courseTopics, subjects, topics } from '../db/schema/index';
import type { Transaction } from '../types/db';
import type { AuState } from '$lib/constants/profile';
import type { CurriculumGroup } from '$lib/types/onboarding';

export const Curriculum = {
	/**
	 * Courses with their chapters, in the shape the onboarding TopicPicker expects.
	 *
	 * No filters → everything (fine at launch: a few hundred chapters).
	 * `state` → national courses + that state's courses.
	 * `yearLevel` → just that year (for fetching per student later instead of up front).
	 */
	async listGroups(
		params: { state?: AuState | null; yearLevel?: number | null } = {},
		tx: Transaction | null = null
	): Promise<CurriculumGroup[]> {
		const conn = tx ?? db;

		const filters: SQL[] = [eq(courses.isActive, true), eq(topics.isActive, true)];
		if (params.state) filters.push(or(isNull(courses.state), eq(courses.state, params.state))!);
		if (params.yearLevel) filters.push(eq(courses.yearLevel, params.yearLevel));

		const rows = await conn
			.select({
				courseKey: courses.key,
				courseName: courses.name,
				yearLevel: courses.yearLevel,
				state: courses.state,
				subjectName: subjects.name,
				topicId: topics.id,
				title: topics.title,
				chapter: courseTopics.chapterNumber
			})
			.from(courses)
			.innerJoin(subjects, eq(subjects.id, courses.subjectId))
			.innerJoin(courseTopics, eq(courseTopics.courseId, courses.id))
			.innerJoin(topics, eq(topics.id, courseTopics.topicId))
			.where(and(...filters))
			.orderBy(
				asc(courses.yearLevel),
				asc(subjects.sortOrder),
				asc(courses.sortOrder),
				asc(courseTopics.chapterNumber)
			);

		// one row per chapter → one group per course (rows arrive already in order)
		const groups = new Map<string, CurriculumGroup>();
		for (const r of rows) {
			let group = groups.get(r.courseKey);
			if (!group) {
				group = {
					key: r.courseKey,
					subject: r.subjectName,
					yearLevel: r.yearLevel,
					course: r.courseName,
					state: r.state,
					topics: []
				};
				groups.set(r.courseKey, group);
			}
			group.topics.push({ id: r.topicId, chapter: r.chapter, title: r.title });
		}
		return [...groups.values()];
	}
};
