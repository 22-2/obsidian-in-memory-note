import type { SandboxNoteView } from "../views/SandboxNoteView";
import type SandboxNotePlugin from "../main";
import type { DirectLogger } from "../utils/logging";

/** Manages shared content synchronization across views */
export class ContentManager {
	private plugin: SandboxNotePlugin;
	private logger: DirectLogger;

	/** Shared content across all views */
	sharedNoteContent = "";

	/** Currently active views */
	activeViews: Set<SandboxNoteView> = new Set();

	constructor(plugin: SandboxNotePlugin, logger: DirectLogger) {
		this.plugin = plugin;
		this.logger = logger;
	}

	/** Update shared content and sync across all views */
	updateNoteContent(content: string, sourceView: SandboxNoteView) {
		this.logger.debug(
			`Updating note content from view: ${sourceView.getViewType()}`
		);
		this.sharedNoteContent = content;

		// Synchronize content to all other active views
		for (const view of this.activeViews) {
			if (view !== sourceView) {
				this.logger.debug(
					`Syncing content to view: ${view.getViewType()}`
				);
				view.setContent(content);
			}
		}
	}

	/** Register a view as active */
	addActiveView(view: SandboxNoteView) {
		this.logger.debug(
			`Adding active view: ${view.getViewType()}, total: ${
				this.activeViews.size + 1
			}`
		);
		this.activeViews.add(view);
	}

	/** Unregister a view */
	removeActiveView(view: SandboxNoteView) {
		this.logger.debug(
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
}
