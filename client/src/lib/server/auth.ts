import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { ADMIN_ACCOUNT_TYPE, STUDENT_ACCOUNT_TYPE, TUTOR_ACCOUNT_TYPE } from '$lib/schemas/auth';

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: { enabled: true },
	plugins: [
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	],
	user: {
		additionalFields: {
			role: {
				type: [STUDENT_ACCOUNT_TYPE, TUTOR_ACCOUNT_TYPE, ADMIN_ACCOUNT_TYPE],
				required: true,
				defaultValue: STUDENT_ACCOUNT_TYPE
			}
		}
	}
});

export type AuthUser = typeof auth.$Infer.Session.user;
export type AuthSession = typeof auth.$Infer.Session.session;
