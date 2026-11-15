import * as z from 'zod';
import { KeySchema, NameSchema } from './shared';

export const UpdateSubjectFormSchema = z.object({
	id: z.string(),
	name: NameSchema,
	key: KeySchema
});

export const DeleteSubjectFormSchema = z.object({
	id: z.string()
});

export const CreateSubjectFormSchema = z.object({
	name: NameSchema,
	key: KeySchema
});
