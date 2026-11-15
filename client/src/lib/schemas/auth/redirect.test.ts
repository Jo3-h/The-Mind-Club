import { describe, expect, it } from 'vitest';
import { DEFAULT_AFTER_LOGIN, safeRedirectPath } from './redirect';

describe('safeRedirectPath', () => {
	it.each(['/sessions/new?tutor=abc&course=sa-11-methods', '/tutors', '/'])('keeps %s', (path) => {
		expect(safeRedirectPath(path)).toBe(path);
	});

	it.each([
		'https://evil.example',
		'//evil.example/path',
		'/\\evil.example',
		'javascript:alert(1)',
		'tutors',
		'/ok\r\nSet-Cookie: x=1',
		'',
		null,
		undefined
	])('falls back for %j', (raw) => {
		expect(safeRedirectPath(raw)).toBe(DEFAULT_AFTER_LOGIN);
	});

	it('falls back for very long values', () => {
		expect(safeRedirectPath('/' + 'a'.repeat(5000))).toBe(DEFAULT_AFTER_LOGIN);
	});
});
