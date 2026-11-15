import type { ResolvedPathname } from '$app/types';

/**
 * Adds a query string to a path that already went through `resolve()`.
 * `set` overrides keys in `base`; a null value removes the key. An empty query adds no "?".
 */
export function withQuery(
	path: ResolvedPathname,
	base: URLSearchParams | string = '',
	set: Record<string, string | null> = {}
): ResolvedPathname {
	const params = new URLSearchParams(base);
	for (const [key, value] of Object.entries(set)) {
		if (value === null) params.delete(key);
		else params.set(key, value);
	}
	const qs = params.toString();
	return (qs ? `${path}?${qs}` : path) as ResolvedPathname;
}
