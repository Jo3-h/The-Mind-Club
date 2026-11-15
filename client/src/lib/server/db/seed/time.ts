/**
 * Small timezone helpers for the seed, so sessions land on real local times
 * (e.g. "next Wednesday 4:30pm in Adelaide") whatever day you run it.
 */

type YMD = { y: number; m: number; d: number };

function partsIn(tz: string, t: number) {
	const f = new Intl.DateTimeFormat('en-AU', {
		timeZone: tz,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		weekday: 'short'
	});
	const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
	return {
		y: Number(p.year),
		m: Number(p.month),
		d: Number(p.day),
		hour: Number(p.hour),
		minute: Number(p.minute),
		weekday: p.weekday as string
	};
}

/** Offset of `tz` from UTC at instant `t`, in ms. */
function offsetMs(tz: string, t: number) {
	const p = partsIn(tz, t);
	return Date.UTC(p.y, p.m - 1, p.d, p.hour, p.minute) - Math.floor(t / 60000) * 60000;
}

/** Local wall-clock (date + minutes from midnight) in `tz` → real instant. DST-safe. */
export function zoned(date: YMD, minutes: number, tz: string): Date {
	const guess = Date.UTC(date.y, date.m - 1, date.d, Math.floor(minutes / 60), minutes % 60);
	let t = guess - offsetMs(tz, guess);
	const second = offsetMs(tz, t);
	if (guess - second !== t) t = guess - second;
	return new Date(t);
}

const ISO_DAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function todayIn(tz: string, now = Date.now()) {
	const p = partsIn(tz, now);
	return { date: { y: p.y, m: p.m, d: p.d }, isoDay: ISO_DAY[p.weekday] };
}

export function addDays(date: YMD, days: number): YMD {
	const t = new Date(Date.UTC(date.y, date.m - 1, date.d + days));
	return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/**
 * The first `isoDay` (1 = Mon … 7 = Sun) strictly after today in `tz`, shifted by `weekOffset` weeks.
 * weekOffset 0 → within the next 7 days; -2 → 8–14 days ago.
 */
export function occurrence(isoDay: number, weekOffset: number, tz: string): YMD {
	const { date, isoDay: today } = todayIn(tz);
	const ahead = (isoDay - today + 7) % 7 || 7;
	return addDays(date, ahead + weekOffset * 7);
}

export function ymdString(d: YMD) {
	return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
}

export const hm = (h: number, m = 0) => h * 60 + m;
