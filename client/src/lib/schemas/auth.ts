import * as z from 'zod';

export const TUTOR_ACCOUNT_TYPE = 'tutor';
export const STUDENT_ACCOUNT_TYPE = 'student';
export const ADMIN_ACCOUNT_TYPE = 'admin';
export const ACCOUNT_TYPES = [
	TUTOR_ACCOUNT_TYPE,
	STUDENT_ACCOUNT_TYPE,
	ADMIN_ACCOUNT_TYPE
] as const;

export const EmailSchema = z.email();
export const PasswordSchema = z
	.string()
	.min(12, 'Password must be at least 12 characters')
	.regex(/[A-Z]/, 'Must include an uppercase letter')
	.regex(/[a-z]/, 'Must include a lowercase letter')
	.regex(/[0-9]/, 'Must include a number')
	.regex(/[^A-Za-z0-9]/, 'Must include a special character');
export const AccountTypeSchema = z.enum(ACCOUNT_TYPES);
export const NameSchema = z.string().min(3, 'Name must be at least 3 characters');

export const SignupSchema = z.object({
	email: EmailSchema,
	password: PasswordSchema,
	name: NameSchema,
	accountType: AccountTypeSchema
});
