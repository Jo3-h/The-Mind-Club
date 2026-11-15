import * as z from 'zod';
import { TEXTBOOK_LENGTH } from '$lib/constants/curriculum';
import { OptionalText } from '../primitives/text';
import { KeySchema, NameSchema, StateSchema, SubjectIdSchema, YearLevelSchema } from './shared';

export const UpdateCourseFormSchema = z.object({
	id: z.string(),
	key: KeySchema,
	name: NameSchema,
	yearLevel: YearLevelSchema,
	subjectId: z.string(),
	state: StateSchema.nullable()
});

export const DeleteCourseFormSchema = z.object({
	id: z.string()
});

export const CreateCourseFormSchema = z.object({
	name: NameSchema,
	key: KeySchema,
	yearLevel: YearLevelSchema,
	state: StateSchema,
	subjectId: SubjectIdSchema
});

/** '' from the "National" option → null (applies in every state). */
const OptionalStateSchema = z.preprocess((v) => (v === '' ? null : v), StateSchema);

/** Course detail page. The id comes from the route, never the form. */
export const UpdateCourseDetailsFormSchema = z.object({
	name: NameSchema,
	key: KeySchema,
	yearLevel: YearLevelSchema,
	state: OptionalStateSchema,
	subjectId: SubjectIdSchema,
	textbook: OptionalText('Textbook', TEXTBOOK_LENGTH)
});
