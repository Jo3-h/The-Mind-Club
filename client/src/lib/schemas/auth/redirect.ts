import * as z from 'zod';

const MAX_REDIRECT_LENGTH = 2048;

/** Where to send someone after login when there's no (valid) redirectTo. */
export const DEFAULT_AFTER_LOGIN = '/onboarding';

/**
 * A same-site path to return to after logging in, e.g. "/sessions/new?tutor=abc".
 * Rejects anything that could leave the site (open-redirect): absolute URLs, protocol-relative
 * "//evil.com", backslash tricks ("/\evil.com") and control characters. Invalid → undefined.
 */
export const SafeRedirectSchema = z
	.string()
	.max(MAX_REDIRECT_LENGTH)
	.refine(
		(v) =>
			v.startsWith('/') &&
			!v.startsWith('//') &&
			!v.includes('\\') &&
			// eslint-disable-next-line no-control-regex
			!/[\u0000-\u001f\u007f]/.test(v),
		'Not a same-site path'
	)
	.optional()
	.catch(undefined);

/** Pass the result to redirect(): a safe same-site path, or DEFAULT_AFTER_LOGIN. */
export function safeRedirectPath(raw: string | null | undefined): string {
	return SafeRedirectSchema.parse(raw ?? undefined) ?? DEFAULT_AFTER_LOGIN;
}
