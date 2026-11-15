import { describe, expect, it } from 'vitest';
import { PostcodeRowSchema, titleCaseSuburb } from './postcodes';

describe('PostcodeRowSchema', () => {
	it('normalises a typical dataset row', () => {
		expect(
			PostcodeRowSchema.parse({
				postcode: '800',
				suburb: 'DARWIN CITY',
				state: 'nt',
				lat: '-12.4634',
				lng: '130.8456'
			})
		).toEqual({
			postcode: '0800',
			suburb: 'Darwin City',
			state: 'NT',
			lat: -12.4634,
			lng: 130.8456
		});
	});

	it.each([
		['bad postcode', { postcode: '50', suburb: 'X', state: 'SA', lat: '-34.9', lng: '138.6' }],
		['unknown state', { postcode: '5000', suburb: 'X', state: 'XX', lat: '-34.9', lng: '138.6' }],
		['outside Australia', { postcode: '5000', suburb: 'X', state: 'SA', lat: '51.5', lng: '-0.1' }],
		['swapped lat/lng', { postcode: '5000', suburb: 'X', state: 'SA', lat: '138.6', lng: '-34.9' }],
		['empty suburb', { postcode: '5000', suburb: ' ', state: 'SA', lat: '-34.9', lng: '138.6' }]
	])('rejects %s', (_, row) => {
		expect(PostcodeRowSchema.safeParse(row).success).toBe(false);
	});
});

describe('titleCaseSuburb', () => {
	it('title-cases words, hyphens and apostrophes', () => {
		expect(titleCaseSuburb('GLENELG NORTH')).toBe('Glenelg North');
		expect(titleCaseSuburb("O'HALLORAN HILL")).toBe("O'Halloran Hill");
		expect(titleCaseSuburb('BURNSIDE-HEIGHTS')).toBe('Burnside-Heights');
	});
});
