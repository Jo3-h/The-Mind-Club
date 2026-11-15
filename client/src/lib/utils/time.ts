import { DAYS } from '$lib/constants/onboarding';
import { DEFAULT_TIME_ZONE } from '$lib/constants/profile';
import type { AvailabilityWindow } from '$lib/types/onboarding';

/** 930 → "3:30pm", 1020 → "5pm" */
export function minutesToLabel(m: number): string {
	const h24 = Math.floor(m / 60);
	const min = m % 60;
	const suffix = h24 >= 12 ? 'pm' : 'am';
	const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
	return min === 0 ? `${h12}${suffix}` : `${h12}:${String(min).padStart(2, '0')}${suffix}`;
}

export function dayShort(day: number): string {
	return DAYS.find((d) => d.value === day)?.short ?? '';
}

/** "Tue 4–6pm" */
export function formatWindow(w: AvailabilityWindow): string {
	const start = minutesToLabel(w.start);
	const end = minutesToLabel(w.end);
	// drop the repeated am/pm when both sides share it: "4–6pm"
	const sameSuffix = start.slice(-2) === end.slice(-2);
	return `${dayShort(w.day)} ${sameSuffix ? start.slice(0, -2) : start}–${end}`;
}

export function totalMinutes(windows: AvailabilityWindow[]): number {
	return windows.reduce((sum, w) => sum + (w.end - w.start), 0);
}

export function formatHours(minutes: number): string {
	const h = minutes / 60;
	return `${Number.isInteger(h) ? h : h.toFixed(1)} hr${h === 1 ? '' : 's'}`;
}

/**
 * "Tue 12 Nov, 4:30pm" in `timeZone`. Pass the user's profile zone so server and browser
 * render the same thing.
 */
export function formatSessionStart(iso: string, timeZone = DEFAULT_TIME_ZONE): string {
	const d = new Date(iso);
	const date = d.toLocaleDateString('en-AU', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		timeZone
	});
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		hour: 'numeric',
		minute: 'numeric'
	}).formatToParts(d);
	const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
	return `${date}, ${minutesToLabel(part('hour') * 60 + part('minute'))}`;
}

/** Defensive parse for the hidden availability input coming back from the server. */
export function parseWindows(raw: unknown): AvailabilityWindow[] {
	if (typeof raw !== 'string' || !raw) return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed)
			? parsed.filter(
					(w) =>
						typeof w?.day === 'number' && typeof w?.start === 'number' && typeof w?.end === 'number'
				)
			: [];
	} catch {
		return [];
	}
}
