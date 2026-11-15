/**
 * Barrel: point drizzle.config.ts `schema` at this file (or at './src/lib/server/db/schema'),
 * and import tables from '$lib/server/db/schema' everywhere else.
 */

export * from './enums';
export * from '../auth-schema';

// reference data
export * from './postcodes';
export * from './subjects';
export * from './courses';
export * from './topics';
export * from './course-topics';

// people
export * from './tutor-profiles';
export * from './student-profiles';
export * from './tutor-topics';
export * from './student-topics';

// time
export * from './weekly-availability';
export * from './availability-exceptions';

// pricing
export * from './pricing-schemes';
export * from './pricing-tiers';

// sessions & money
export * from './session-series';
export * from './tutoring-sessions';
export * from './bookings';
export * from './payments';
export * from './stripe-events';
