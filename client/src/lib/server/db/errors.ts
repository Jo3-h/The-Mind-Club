export function pgErrorCode(e: unknown): string | undefined {
	const err = e as { code?: string; cause?: { code?: string } };
	return err?.code ?? err?.cause?.code;
}
export const isUniqueViolation = (e: unknown) => pgErrorCode(e) === '23505';
