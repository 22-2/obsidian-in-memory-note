import type { SandboxNoteView } from "./SandboxNoteView";

/**
 * Set the editor content if it's different from the provided content.
 * This is used for synchronizing views.
 * @param view The instance of the SandboxNoteView.
 * @param content The new content to set.
 */
export function setContent(view: SandboxNoteView, content: string) {
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
	if (existingViews.length > 1) {
		// Get content from an existing view (excluding this one)
		const sourceView = existingViews.find((v) => v !== view);
		if (sourceView && sourceView.editor) {
			view.plugin.contentManager.sharedNoteContent =
				sourceView.editor.getValue();
			// Also sync the initial content to match the existing view's state
			view.initialContent = sourceView.initialContent;
		}
	}
}
