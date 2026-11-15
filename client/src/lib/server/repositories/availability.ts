import { asc, eq, inArray } from 'drizzle-orm';
import { db, type Executor } from '../db';
import { weeklyAvailability } from '../db/schema/weekly-availability';
import type { WeeklyWindow } from '../domain/availability';

const toWindow = (r: {
	weekday: number;
	startMinute: number;
	endMinute: number;
}): WeeklyWindow => ({
	day: r.weekday,
	start: r.startMinute,
	end: r.endMinute
});

export const Availability = {
	async listForUser(params: { userId: string; tx?: Executor }): Promise<WeeklyWindow[]> {
		const { userId, tx = db } = params;
		const rows = await tx
			.select()
			.from(weeklyAvailability)
			.where(eq(weeklyAvailability.userId, userId))
			.orderBy(asc(weeklyAvailability.weekday), asc(weeklyAvailability.startMinute));
		return rows.map(toWindow);
	},

	/** Windows for many users at once, keyed by user id. */
	async listForUsers(params: {
		userIds: string[];
		tx?: Executor;
	}): Promise<Map<string, WeeklyWindow[]>> {
		const { userIds, tx = db } = params;
		const out = new Map<string, WeeklyWindow[]>();
		if (userIds.length === 0) return out;
		const rows = await tx
			.select()
			.from(weeklyAvailability)
			.where(inArray(weeklyAvailability.userId, userIds))
			.orderBy(asc(weeklyAvailability.weekday), asc(weeklyAvailability.startMinute));
		for (const r of rows) {
			const list = out.get(r.userId) ?? [];
			list.push(toWindow(r));
			out.set(r.userId, list);
		}
		return out;
	},

	/**
	 * Replaces the user's whole weekly set (delete + insert), as the schema intends.
	 * Two writes, so it runs in a transaction (a save point if the caller already has one).
	 * Windows must already be validated/normalised (domain/availability.normaliseWindows).
	 */
	async replaceForUser(params: { userId: string; windows: WeeklyWindow[]; tx?: Executor }) {
		const { userId, windows, tx = db } = params;
		await tx.transaction(async (t) => {
			await t.delete(weeklyAvailability).where(eq(weeklyAvailability.userId, userId));
			if (windows.length > 0) {
				await t.insert(weeklyAvailability).values(
					windows.map((w) => ({
						userId,
						weekday: w.day,
						startMinute: w.start,
						endMinute: w.end
					}))
				);
			}
		});
	}
};
