import type { InMemoryNoteView } from "../view";
import type InMemoryNotePlugin from "../main";
import type { DirectLogger } from "../utils/logging";

/** Manages shared content synchronization across views */
export class ContentManager {
	private plugin: InMemoryNotePlugin;
	private logger: DirectLogger;
	
	/** Shared content across all views */
	sharedNoteContent = "";
	
	/** Currently active views */
	activeViews: Set<InMemoryNoteView> = new Set();

	constructor(plugin: InMemoryNotePlugin, logger: DirectLogger) {
		this.plugin = plugin;
		this.logger = logger;
	}

	/** Update shared content and sync across all views */
	updateNoteContent(content: string, sourceView: InMemoryNoteView) {
		this.sharedNoteContent = content;

		// Synchronize content to all other active views
		for (const view of this.activeViews) {
			if (view !== sourceView) {
				view.setContent(content);
			}
		}
	}

	/** Register a view as active */
	addActiveView(view: InMemoryNoteView) {
		this.activeViews.add(view);
	}

	/** Unregister a view */
	removeActiveView(view: InMemoryNoteView) {
		this.activeViews.delete(view);
	}

	/** Refresh all view titles when settings change */
	refreshAllViewTitles() {
		for (const view of this.activeViews) {
			view.leaf.updateHeader();
		}
	}
}