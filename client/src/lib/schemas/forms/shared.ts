import { STATES, YEAR_LEVELS } from '$lib/constants/profile';
import { CURRICULUM_KEY_LENGTH, CURRICULUM_NAME_LENGTH } from '$lib/constants/curriculum';
import * as z from 'zod';
import { NumberLike } from '../primitives/number-like';
import { RequiredText } from '../primitives/text';

export const KeySchema = RequiredText('Key', CURRICULUM_KEY_LENGTH);
export const NameSchema = RequiredText('Name', CURRICULUM_NAME_LENGTH);
export const YearLevelSchema = NumberLike('Year Level').pipe(z.literal(YEAR_LEVELS));
export const StateSchema = z.enum(STATES).nullable();
export const SubjectIdSchema = z.uuid();
