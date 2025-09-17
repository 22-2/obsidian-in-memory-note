import { App } from "obsidian";

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
	timeout = 10 * 1000,
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
 * @param app The Obsidian App instance.
 * @param e The mouse event.
 */
const handleContextMenu = async (app: App, e: MouseEvent) => {
	const target = e.target;
	if (!(target instanceof HTMLElement)) return;

	if (!target.matches(".view-content")) return;
	app.commands.executeCommandById("editor:context-menu");

	try {
		const menu = await waitForElement(".menu", document);
		Object.assign(menu.style, {
			top: `${e.y}px`,
			left: `${e.x}px`,
		});
	} catch (error) {
		console.log("Focus Canvas Plugin: Menu element not found within timeout.");
	}
};

/**
 * Handles the click event on the view content.
 * It sets the cursor position and focuses the editor.
 * @param app The Obsidian App instance.
 * @param e The mouse event.
 */
const handleClick = (app: App, e: MouseEvent) => {
	const target = e.target;
	if (!(target instanceof HTMLElement)) return;
	if (!target.matches(".view-content")) return;
	let editor = app.workspace.activeEditor?.editor;
	if (!editor) return;
	const pos = editor.posAtMouse(e);
	setTimeout(() => {
		editor.setCursor(pos);
		editor.setSelection(pos, pos);
		editor.focus();
	}, 0);
};

// Bound handlers to be used for event listeners
let boundHandleClick: (e: MouseEvent) => void;
let boundHandleContextMenu: (e: MouseEvent) => void;

/**
 * Registers the DOM event handlers for a given window.
 * @param app The Obsidian App instance.
 * @param target The window to register the handlers on.
 */
export const registerClickHandlers = (app: App, target: Window) => {
	boundHandleClick = handleClick.bind(null, app);
	boundHandleContextMenu = handleContextMenu.bind(null, app);
	target.addEventListener("mousedown", boundHandleClick);
	target.addEventListener("contextmenu", boundHandleContextMenu);
};

/**
 * Removes the DOM event handlers from a given window.
 * @param target The window to remove the handlers from.
 */
export const removeClickHandlers = (target: Window) => {
	target.removeEventListener("mousedown", boundHandleClick);
	target.removeEventListener("contextmenu", boundHandleContextMenu);
};
