import type { SandboxNoteView } from "../views/SandboxNoteView";
import type SandboxNotePlugin from "../main";
import log from "loglevel";
import type { AbstractNoteView } from "src/views/helpers/AbstractNoteView"; // 追記

/** Manages shared content synchronization across views */
export class EditorSyncManager {
	private plugin: SandboxNotePlugin;

	/** Shared content across all views */
	currenSharedNoteContent = "";

	/** Content that was last saved */
	lastSavedContent = "";

	/** Whether the current content has unsaved changes */
	hasUnsavedChanges = false;

	/** Currently active views */
	activeViews: Set<SandboxNoteView> = new Set();

	constructor(plugin: SandboxNotePlugin) {
		this.plugin = plugin;
	}

	/** Update shared content and sync across all views */
	syncAll(content: string, sourceView: AbstractNoteView) {
		log.debug(
			`Updating note content from view: ${sourceView.getViewType()}`
		);
		this.currenSharedNoteContent = content;
		this.updateUnsavedState();

		// Synchronize content to all other active views
		for (const view of this.activeViews) {
			if (view !== sourceView) {
				log.debug(`Syncing content to view: ${view.getViewType()}`);
				view.setContent(content);
			}
		}
	}

	/** Updates the unsaved state and notifies views if it changed. */
	private updateUnsavedState() {
		const wasUnsaved = this.hasUnsavedChanges;
		this.hasUnsavedChanges =
			this.currenSharedNoteContent !== this.lastSavedContent;

		if (wasUnsaved !== this.hasUnsavedChanges) {
			log.debug(`Unsaved state changed to: ${this.hasUnsavedChanges}`);
			this.refreshAllViewTitles();
			this.refreshAllViewActionButtons();
		}
	}

	/** Marks the current content as saved. */
	markAsSaved() {
		this.lastSavedContent = this.currenSharedNoteContent;
		this.updateUnsavedState();
		log.debug("Content marked as saved.");
	}

	/** Register a view as active */
	addActiveView(view: SandboxNoteView) {
		log.debug(
			`Adding active view: ${view.getViewType()}, total: ${
				this.activeViews.size + 1
			}`
		);
		this.activeViews.add(view);
		// Ensure new view has correct button state
		view.updateActionButtons();
	}

	/** Unregister a view */
	removeActiveView(view: SandboxNoteView) {
		log.debug(
			`Removing active view: ${view.getViewType()}, remaining: ${
				this.activeViews.size - 1
			}`
		);
		this.activeViews.delete(view);
	}

	/** Refresh all view titles when settings change */
	refreshAllViewTitles() {
		for (const view of this.activeViews) {
			view.leaf.updateHeader();
		}
	}

	/** Refresh all view action buttons. */
	private refreshAllViewActionButtons() {
		for (const view of this.activeViews) {
			view.updateActionButtons();
		}
	}
}
