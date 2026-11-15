import * as z from 'zod';
import {
	CHAPTER_NUMBER,
	CHAPTER_TITLE_LENGTH,
	COURSE_TOPIC_NOTES_LENGTH,
	PAGE_NUMBER
} from '$lib/constants/curriculum';
import type { Constraint } from '$lib/constants/shared';
import { NumberLike } from '../primitives/number-like';
import { OptionalText } from '../primitives/text';

const WholeNumberIn = (label: string, c: Constraint) =>
	NumberLike(label).pipe(
		z
			.number()
			.int(`${label} must be a whole number`)
			.min(c.MIN, `${label} must be at least ${c.MIN}`)
			.max(c.MAX, `${label} must be at most ${c.MAX}`)
	);

/** '' from an empty number field → null; otherwise a whole number within `c`. */
const OptionalWholeNumberIn = (label: string, c: Constraint) =>
	z.union([z.literal('').transform(() => null), WholeNumberIn(label, c)]);

const ReferenceFields = z.object({
	chapterNumber: WholeNumberIn('Chapter', CHAPTER_NUMBER),
	chapterTitle: OptionalText('Chapter title', CHAPTER_TITLE_LENGTH),
	pageStart: OptionalWholeNumberIn('Start page', PAGE_NUMBER),
	pageEnd: OptionalWholeNumberIn('End page', PAGE_NUMBER),
	notes: OptionalText('Notes', COURSE_TOPIC_NOTES_LENGTH)
});

const pagesInOrder = (d: { pageStart: number | null; pageEnd: number | null }) =>
	d.pageStart === null || d.pageEnd === null || d.pageEnd >= d.pageStart;
const pagesInOrderError = {
	message: 'End page must be on or after the start page',
	path: ['pageEnd']
};

/**
 * On the topic page the link is identified by courseId (topic comes from the route);
 * on the course page by topicId (course comes from the route). Never both from the form.
 */
export const AddCourseTopicFormSchema = ReferenceFields.extend({ courseId: z.uuid() }).refine(
	pagesInOrder,
	pagesInOrderError
);
export const UpdateCourseTopicFormSchema = AddCourseTopicFormSchema;
export const RemoveCourseTopicFormSchema = z.object({
	courseId: z.uuid()
});

export const AddTopicToCourseFormSchema = ReferenceFields.extend({ topicId: z.uuid() }).refine(
	pagesInOrder,
	pagesInOrderError
);
export const UpdateTopicInCourseFormSchema = AddTopicToCourseFormSchema;
export const RemoveTopicFromCourseFormSchema = z.object({
	topicId: z.uuid()
});
