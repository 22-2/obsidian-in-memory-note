export const noop = async () => {};

/** A function that has been debounced, with a `cancel` method to prevent its next execution. */
export interface DebouncedFunction<T extends (...args: any[]) => any> {
	(...args: Parameters<T>): void;
	cancel(): void;
}

/**
 * Creates a debounced function that delays invoking `func` until after `wait`
 * milliseconds have elapsed since the last time the debounced function was
 * invoked.
 *
 * @param func The function to debounce.
 * @param wait The number of milliseconds to delay.
 * @returns A new debounced function with a `cancel` method.
 */
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number
): DebouncedFunction<T> {
	let timeout: NodeJS.Timeout;

	const debounced = function (
		this: ThisParameterType<T>,
		...args: Parameters<T>
	) {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const context = this;
		clearTimeout(timeout);
		timeout = setTimeout(() => func.apply(context, args), wait);
	} as DebouncedFunction<T>;

	debounced.cancel = () => {
		clearTimeout(timeout);
	};

	return debounced;
}
