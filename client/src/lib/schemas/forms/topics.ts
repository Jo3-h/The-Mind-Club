import * as z from 'zod';
import { KeySchema, NameSchema, SubjectIdSchema } from './shared';

export const UpdateTopicFormSchema = z.object({
	id: z.string(),
	title: NameSchema,
	key: KeySchema,
	subjectId: SubjectIdSchema
});

export const DeleteTopicFormSchema = z.object({
	id: z.string()
});

export const CreateTopicFormSchema = z.object({
	title: NameSchema,
	subjectId: SubjectIdSchema
});
