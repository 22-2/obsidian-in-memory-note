import log from "loglevel";
import { Editor, MarkdownEditView } from "obsidian";
import type { Commands } from "obsidian-typings";
import type { AbstractNoteView } from "src/views/internal/AbstractNoteView";

/** Handle right-click context menu events. */
export const handleContextMenu = async (
	e: PointerEvent,
	editMode: MarkdownEditView
) => {
	const target = e.target;
	if (!(target instanceof HTMLElement)) return;

	// Only handle context menu for view content areas
	if (!target.matches(".view-content")) return;

	editMode.onContextMenu(e, true);
};

/** Handle click events for better editor focus. */
export const handleClick = (e: MouseEvent, editor: Editor) => {
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

/** Handle keydown events, specifically for Ctrl+S save functionality. */
export const handleKeyDown = (e: KeyboardEvent, view: AbstractNoteView) => {
	const activeView = view.app.workspace.activeLeaf?.view;
	if (activeView !== view) return;

	if (!view.editor?.hasFocus()) return;
	if (
		view.plugin.data.settings.enableCtrlS &&
		(e.ctrlKey || e.metaKey) &&
		e.key === "s"
	) {
		e.preventDefault(); // Prevent default browser save action
		e.stopPropagation(); // Stop the event from propagating further
		log.debug("Saving note via Ctrl+S");
		view.save();
	}
};
