export function formToObject(fd: FormData) {
	return Object.fromEntries(fd.entries());
}
