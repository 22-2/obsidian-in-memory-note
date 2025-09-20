import type { AbstractNoteView } from "../views/AbstractNoteView";

/**
 * Update the visibility and state of action buttons based on unsaved changes.
 * @param view The instance of the AbstractNoteView.
 */
export function updateActionButtons(view: AbstractNoteView): void {
	if (!view.plugin.settings.enableSaveNoteContent) {
		view.saveActionEl?.hide();
		return;
	}

	if (!view.saveActionEl) {
		view.saveActionEl = view.addAction("save", "Save", () => view.save());
	}
	view.saveActionEl.show();

	const shouldShowUnsaved =
		view.plugin.settings.enableSaveNoteContent && view.hasUnsavedChanges;

	view.saveActionEl.toggleClass("is-disabled", !shouldShowUnsaved);
	view.saveActionEl.setAttribute("aria-disabled", String(!shouldShowUnsaved));
}
