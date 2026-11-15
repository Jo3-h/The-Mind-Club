import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/types', () => ({}));
const { withQuery } = await import('./links');

type P = Parameters<typeof withQuery>[0];

describe('withQuery', () => {
	it('returns the path unchanged with no query', () => {
		expect(withQuery('/tutors' as P)).toBe('/tutors');
	});
	it('keeps the base query and applies overrides', () => {
		expect(withQuery('/tutors' as P, 'subject=maths&page=2', { page: '3' })).toBe(
			'/tutors?subject=maths&page=3'
		);
	});
	it('removes keys set to null', () => {
		expect(withQuery('/tutors/x' as P, 'subject=maths&page=2', { page: null })).toBe(
			'/tutors/x?subject=maths'
		);
		expect(withQuery('/tutors' as P, 'page=2', { page: null })).toBe('/tutors');
	});
	it('encodes values', () => {
		expect(withQuery('/sessions/new' as P, '', { tutor: 'a b&c' })).toBe(
			'/sessions/new?tutor=a+b%26c'
		);
	});
});
