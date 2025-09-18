import { Editor, MarkdownView } from "obsidian";
import type { Commands } from "obsidian-typings";

/**
 * Waits for a DOM element matching the specified selector to become available.
 * @param cssSelector The CSS selector of the element to wait for.
 * @param doc The document to search in.
 * @param timeout The maximum time to wait in milliseconds.
 * @returns A promise that resolves with the found element.
 * @throws An error if the element is not found within the timeout.
 */
function waitForElement(
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

/**
 * Handles the context menu event on the view content.
 * It opens the editor's context menu at the right-click position.
 * @param commands The Obsidian Commands instance.
 * @param e The mouse event.
 */
export const handleContextMenu = async (
	commands: Commands,
	view: MarkdownView,
	e: MouseEvent
) => {
	const target = e.target;
	if (!(target instanceof HTMLElement)) return;

	if (!target.matches(".view-content")) return;
	commands
		.findCommand("editor:context-menu")
		?.editorCallback?.(view.editor, view);

	try {
		const menu = await waitForElement(".menu", document);
		Object.assign(menu.style, {
			top: `${e.y}px`,
			left: `${e.x}px`,
		});
	} catch (error) {
		console.log(
			"Focus Canvas Plugin: Menu element not found within timeout."
		);
	}
};

/**
 * Handles the click event on the view content.
 * It sets the cursor position and focuses the editor.
 * @param app The Obsidian Editor instance.
 * @param e The mouse event.
 */
export const handleClick = (editor: Editor, e: MouseEvent) => {
	const target = e.target;
	if (!(target instanceof HTMLElement)) return;
	if (!(target.matches(".view-content") || target.matches(".cm-sizer")))
		return;
	const pos = editor.posAtMouse(e);
	setTimeout(() => {
		editor.setCursor(pos);
		editor.setSelection(pos, pos);
		editor.focus();
	}, 0);
};
