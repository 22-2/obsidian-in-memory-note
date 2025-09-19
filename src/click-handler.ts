import { Editor, MarkdownEditView, MarkdownView } from "obsidian";
import type { Commands } from "obsidian-typings";
import { waitForElement } from "./utils/dom";

/**
 * Handles right-click context menu events on the view content.
 * Enables context menu display even when clicking in blank areas of the editor.
 * @param commands The Obsidian Commands instance.
 * @param editMode The markdown edit view mode.
 * @param e The pointer event from the right-click.
 */
export const handleContextMenu = async (
	commands: Commands,
	editMode: MarkdownEditView,
	e: PointerEvent
) => {
	const target = e.target;
	if (!(target instanceof HTMLElement)) return;

	// Only handle context menu for view content areas
	if (!target.matches(".view-content")) return;
	
	editMode.onContextMenu(e, true);
};

/**
 * Handles click events on the view content to improve editor focus behavior.
 * Allows focusing the editor and positioning the cursor even when clicking in blank areas.
 * @param editor The Obsidian Editor instance.
 * @param e The mouse click event.
 */
export const handleClick = (editor: Editor, e: MouseEvent) => {
	const target = e.target;
	if (!(target instanceof HTMLElement)) return;
	
	// Only handle clicks on view content or editor sizer areas
	if (!(target.matches(".view-content") || target.matches(".cm-sizer"))) {
		return;
	}
	
	// Calculate cursor position from mouse coordinates
	const cursorPosition = editor.posAtMouse(e);
	
	// Set cursor position and focus editor after DOM updates
	setTimeout(() => {
		editor.setCursor(cursorPosition);
		editor.setSelection(cursorPosition, cursorPosition);
		editor.focus();
	}, 0);
};
