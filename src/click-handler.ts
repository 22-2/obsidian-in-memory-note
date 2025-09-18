import { Editor, MarkdownEditView, MarkdownView } from "obsidian";
import type { Commands } from "obsidian-typings";
import { waitForElement } from "./utils/dom";

/**
 * Handles the context menu event on the view content, allowing it to be shown
 * in blank areas. It opens the editor's context menu at the right-click position.
 * @param commands The Obsidian Commands instance.
 * @param e The mouse event.
 */
export const handleContextMenu = async (
	commands: Commands,
	editMode: MarkdownEditView,
	e: PointerEvent
) => {
	const target = e.target;
	if (!(target instanceof HTMLElement)) return;

	if (!target.matches(".view-content")) return;
	editMode.onContextMenu(e, true);
};

/**
 * Handles the click event on the view content, focusing the editor even when clicking
 * in a blank area. It sets the cursor position and focuses the editor.
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
