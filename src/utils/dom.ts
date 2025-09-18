/**
 * Waits for a DOM element matching the specified selector to become available.
 * @param cssSelector The CSS selector of the element to wait for.
 * @param doc The document to search in.
 * @param timeout The maximum time to wait in milliseconds.
 * @returns A promise that resolves with the found element.
 * @throws An error if the element is not found within the timeout.
 */
export function waitForElement(
	cssSelector: string,
	doc: Document = document,
	timeout = 10 * 1000
): Promise<HTMLElement> {
	return new Promise((resolve, reject) => {
		const element = doc.querySelector(cssSelector) as HTMLElement;
		if (element) {
			resolve(element);
			return;
		}
		const observer = new MutationObserver(() => {
			const element = doc.querySelector(cssSelector) as HTMLElement;
			if (element) {
				observer.disconnect();
				resolve(element);
			}
		});
		observer.observe(doc.documentElement, {
			childList: true,
			subtree: true,
		});
		setTimeout(() => {
			observer.disconnect();
			reject(new Error(`Timeout waiting for element: ${cssSelector}`));
		}, timeout);
	});
}
