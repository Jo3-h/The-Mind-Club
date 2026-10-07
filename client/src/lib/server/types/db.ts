import type { db } from '$lib/server/db';

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
