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
export function synchronizeWithExistingViews(view: SandboxNoteView) {
	const active = view.plugin.editorSyncManager.activeViews || [];
	const existingViews = Array.from(active);
	const sourceView = existingViews.find((v) => v !== view);

	if (sourceView?.editor) {
		const content = sourceView.editor.getValue();
		view.plugin.editorSyncManager.currenSharedNoteContent = content;
		// Directly set the content in the new view's editor
		view.setContent(content);
		return;
	}

	// If no other views are open, but there's initial content from startup, use it.
	const initialContent =
		view.plugin.editorSyncManager.currenSharedNoteContent;
	if (initialContent) {
		view.setContent(initialContent);
	}
}
