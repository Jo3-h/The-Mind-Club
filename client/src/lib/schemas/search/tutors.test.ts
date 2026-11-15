import { describe, expect, it } from 'vitest';
import { parseTutorSearchParams } from './tutors';

const parse = (query: string) => parseTutorSearchParams(new URLSearchParams(query));

describe('parseTutorSearchParams', () => {
	it('has sensible defaults for an empty query', () => {
		expect(parse('')).toEqual({
			subject: undefined,
			state: undefined,
			year: undefined,
			course: undefined,
			when: [],
			mine: false,
			mode: 'either',
			postcode: undefined,
			tz: undefined,
			page: 1
		});
	});

	it('parses a full query, including repeated params', () => {
		expect(
			parse(
				'subject=maths&state=SA&year=11&course=sa-11-methods&when=2-after&when=4-evening' +
					'&mine=1&mode=in_person&postcode=0800&tz=Australia/Darwin&page=3'
			)
		).toEqual({
			subject: 'maths',
			state: 'SA',
			year: 11,
			course: 'sa-11-methods',
			when: ['2-after', '4-evening'],
			mine: true,
			mode: 'in_person',
			postcode: '0800',
			tz: 'Australia/Darwin',
			page: 3
		});
	});

	it('tells "any" (null) apart from "not given" (undefined) for state and year', () => {
		expect(parse('state=any&year=any')).toMatchObject({ state: null, year: null });
		expect(parse('subject=maths')).toMatchObject({ state: undefined, year: undefined });
	});

	it('drops bad values instead of failing', () => {
		expect(
			parse(
				'subject=Maths!&state=XX&year=13&course=<script>&when=9-after&when=2-lunch' +
					'&mine=yes&mode=teleport&postcode=50&tz=Nope/Zone&page=-2'
			)
		).toEqual({
			subject: undefined,
			state: undefined,
			year: undefined,
			course: undefined,
			when: [],
			mine: false,
			mode: 'either',
			postcode: undefined,
			tz: undefined,
			page: 1
		});
	});
});
