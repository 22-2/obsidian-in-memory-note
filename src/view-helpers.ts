import type { SandboxNoteView } from "./view";

/**
 * Get the display text for the view tab, showing an asterisk for unsaved changes.
 * @param view The instance of the SandboxNoteView.
 * @returns The display text for the tab.
 */
export function getDisplayText(view: SandboxNoteView): string {
	const baseTitle = "Sandbox note";
	// Only show asterisk if save setting is enabled and there are unsaved changes
	const shouldShowUnsaved =
		view.plugin.settings.enableSaveNoteContent && view.hasUnsavedChanges;
	return shouldShowUnsaved ? `*${baseTitle}` : baseTitle;
}

/**
 * Update the visibility and state of action buttons based on unsaved changes.
 * @param view The instance of the SandboxNoteView.
 */
export function updateActionButtons(view: SandboxNoteView): void {
	if (!view.plugin.settings.enableSaveNoteContent) {
		view.saveActionEl?.hide();
		return;
	}

	if (!view.saveActionEl) {
		view.saveActionEl = view.addAction("save", "Save", view.save);
	}
	view.saveActionEl.show();

	const shouldShowUnsaved =
		view.plugin.settings.enableSaveNoteContent && view.hasUnsavedChanges;

	view.saveActionEl.toggleClass("is-disabled", !shouldShowUnsaved);
	view.saveActionEl.setAttribute(
		"aria-disabled",
		String(!shouldShowUnsaved)
	);
}
