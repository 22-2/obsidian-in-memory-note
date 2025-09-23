import type { AbstractNoteView } from "src/views/helpers/AbstractNoteView";
import type { SandboxNoteView } from "../views/SandboxNoteView";

/**
 * Set the editor content if it's different from the provided content.
 * This is used for synchronizing views.
 * @param view The instance of the AbstractNoteView.
 * @param content The new content to set.
 */
export function setContent(view: AbstractNoteView, content: string) {
	if (!view.containerEl.isShown()) return;
	if (view.editor && view.editor.getValue() !== content) {
		view.editor.setValue(content);
		// Update unsaved state when content is synchronized from other views
		view.updateUnsavedState(content);
		// Refresh the tab title
		view.leaf.updateHeader();
	}
}

/**
 * Synchronize the content of a new view with existing views.
 * @param view The instance of the SandboxNoteView to synchronize.
 */
export function synchronizeWithExistingViews(view: SandboxNoteView) {
	const existingViews = Array.from(view.plugin.contentManager.activeViews);
	const sourceView = existingViews.find((v) => v !== view);

	if (sourceView?.editor) {
		const content = sourceView.editor.getValue();
		view.plugin.contentManager.sharedNoteContent = content;
		view.initialContent = sourceView.initialContent;
		// Directly set the content in the new view's editor
		view.setContent(content);
		return;
	}

	// If no other views are open, but there's initial content from startup, use it.
	const initialContent = view.plugin.contentManager.sharedNoteContent;
	if (initialContent) {
		view.setContent(initialContent);
	}
}
