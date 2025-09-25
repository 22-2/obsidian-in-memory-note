export function uniqBy<T, U>(arr: T[], mapper: (item: T) => U): T[] {
	const seen = new Set<U>();
	const result: T[] = [];

	for (const item of arr) {
		const key = mapper(item);
		if (!seen.has(key)) {
			seen.add(key);
			result.push(item);
		}
	}

	return result;
}
export const noop = async () => {};
