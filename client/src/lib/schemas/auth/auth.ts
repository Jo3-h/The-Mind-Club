import { ACCOUNT_TYPES } from '$lib/constants/profile';
import { DISPLAY_NAME_LENGTH, PASSWORD_LENGTH } from '$lib/constants/auth';
import * as z from 'zod';
import { SafeRedirectSchema } from './redirect';

export const EmailSchema = z.email();
export const PasswordSchema = z
	.string()
	.min(PASSWORD_LENGTH.MIN, `Password must be at least ${PASSWORD_LENGTH.MIN} characters`)
	.max(PASSWORD_LENGTH.MAX, `Password must be ${PASSWORD_LENGTH.MAX} characters or fewer`)
	.regex(/[A-Z]/, 'Must include an uppercase letter')
	.regex(/[a-z]/, 'Must include a lowercase letter')
	.regex(/[0-9]/, 'Must include a number')
	.regex(/[^A-Za-z0-9]/, 'Must include a special character');
export const AccountTypeSchema = z.enum(ACCOUNT_TYPES);
export const NameSchema = z
	.string()
	.trim()
	.min(DISPLAY_NAME_LENGTH.MIN, `Name must be at least ${DISPLAY_NAME_LENGTH.MIN} characters`)
	.max(DISPLAY_NAME_LENGTH.MAX, `Name must be ${DISPLAY_NAME_LENGTH.MAX} characters or fewer`);

/** Account type is chosen in onboarding, not at sign up. */
export const SignupSchema = z.object({
	email: EmailSchema,
	password: PasswordSchema,
	name: NameSchema
});

/**
 * Login only checks shape: the password rules above apply when it's set, not when it's typed
 * (an old password that predates a rule change must still log in).
 */
export const LoginSchema = z.object({
	email: EmailSchema,
	password: z.string().min(1, 'Enter your password').max(PASSWORD_LENGTH.MAX),
	redirectTo: SafeRedirectSchema
});
