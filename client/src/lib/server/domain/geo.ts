// Straight-line distance between postcode centroids. Good enough for "will this tutor travel
// to me?" at launch scale; no PostGIS needed (see db/schema/postcodes.ts).

export interface LatLng {
	lat: number;
	lng: number;
}

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle (haversine) distance in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
	return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Is `point` within `radiusKm` of `centre`? */
export function isWithinRadius(centre: LatLng, point: LatLng, radiusKm: number): boolean {
	return distanceKm(centre, point) <= radiusKm;
}
