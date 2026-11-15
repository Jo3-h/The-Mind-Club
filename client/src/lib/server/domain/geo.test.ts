import { describe, expect, it } from 'vitest';
import { distanceKm, isWithinRadius } from './geo';

const ADELAIDE_CBD = { lat: -34.9285, lng: 138.6007 };
const GLENELG = { lat: -34.9806, lng: 138.5155 };
const MELBOURNE_CBD = { lat: -37.8136, lng: 144.9631 };

describe('distanceKm', () => {
	it('is zero for the same point', () => {
		expect(distanceKm(ADELAIDE_CBD, ADELAIDE_CBD)).toBe(0);
	});
	it('is about 9.6 km from Adelaide CBD to Glenelg', () => {
		expect(distanceKm(ADELAIDE_CBD, GLENELG)).toBeCloseTo(9.6, 0);
	});
	it('is about 650 km from Adelaide to Melbourne', () => {
		expect(distanceKm(ADELAIDE_CBD, MELBOURNE_CBD)).toBeGreaterThan(640);
		expect(distanceKm(ADELAIDE_CBD, MELBOURNE_CBD)).toBeLessThan(660);
	});
	it('is symmetric', () => {
		expect(distanceKm(GLENELG, ADELAIDE_CBD)).toBeCloseTo(distanceKm(ADELAIDE_CBD, GLENELG), 9);
	});
});

describe('isWithinRadius', () => {
	it('uses the radius as an inclusive limit', () => {
		expect(isWithinRadius(ADELAIDE_CBD, GLENELG, 10)).toBe(true);
		expect(isWithinRadius(ADELAIDE_CBD, GLENELG, 5)).toBe(false);
	});
});
