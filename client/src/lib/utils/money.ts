/**
 * Money helpers. Money is integer cents (AUD) everywhere; these only convert at the edges.
 * Parsing works on the string, so no floating point ever touches the amount.
 */

/** "65" → 6500, "65.5" → 6550, "65.05" → 6505. Null if it isn't a plain dollar amount. */
export function dollarsToCents(input: string): number | null {
	const match = /^\s*\$?(\d{1,7})(?:\.(\d{1,2}))?\s*$/.exec(input);
	if (!match) return null;
	const [, dollars, cents = ''] = match;
	return Number(dollars) * 100 + Number(cents.padEnd(2, '0'));
}

/** 6500 → "65", 6550 → "65.50". For filling a dollars input from stored cents. */
export function centsToDollarsInput(cents: number): string {
	const dollars = Math.floor(cents / 100);
	const rest = cents % 100;
	return rest === 0 ? String(dollars) : `${dollars}.${String(rest).padStart(2, '0')}`;
}

/** 6500 → "$65", 6550 → "$65.50". */
export function formatCents(cents: number): string {
	return `$${centsToDollarsInput(cents)}`;
}
