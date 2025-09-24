import type { AbstractNoteView } from "src/views/internal/AbstractNoteView";
import type { SandboxNoteView } from "../views/SandboxNoteView";

/**
 * Set the editor content if it's different from the provided content.
 * This is used for synchronizing views.
 * @param view The instance of the AbstractNoteView.
 * @param content The new content to set.
 */
export function setContent(view: AbstractNoteView, content: string) {
	if (view.editor && view.editor.getValue() !== content) {
		view.editor.setValue(content);
		// The central manager now handles the unsaved state.
		// Refresh the tab title to reflect any state changes from the manager.
		view.leaf.updateHeader();
	}
}

/**
 * Synchronize the content of a new view with existing views.
 * @param view The instance of the SandboxNoteView to synchronize.
 */
export function syncViewContent(view: SandboxNoteView) {
	// If no other views are open, but there's initial content from startup, use it.
	const initialContent =
		view.plugin.editorSyncManager.currentSharedNoteContent;
	if (initialContent) {
		view.setContent(initialContent);
	}
}
