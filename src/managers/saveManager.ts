import { InMemoryNoteView } from "../view";
import type InMemoryNotePlugin from "../main";
import type { DirectLogger } from "../utils/logging";

/** Manages content persistence and auto-save functionality */
export class SaveManager {
	private plugin: InMemoryNotePlugin;
	private logger: DirectLogger;
	private previousActiveView: InMemoryNoteView | null = null;

	constructor(plugin: InMemoryNotePlugin, logger: DirectLogger) {
		this.plugin = plugin;
		this.logger = logger;
	}

	/** Handle active leaf changes and auto-save if enabled */
	handleActiveLeafChange() {
		const activeView =
			this.plugin.app.workspace.getActiveViewOfType(InMemoryNoteView);

		// Auto-save content from previous view when save setting is enabled
		if (
			this.plugin.settings.enableSaveNoteContent &&
			this.previousActiveView
		) {
			this.saveNoteContentToFile(this.previousActiveView);
		}

		this.previousActiveView = activeView;
	}

	/** Save note content to data.json using Obsidian API */
	async saveNoteContentToFile(view: InMemoryNoteView) {
		try {
			const content = view.inlineEditor.getContent();

			// Skip saving if content is empty or only whitespace
			if (typeof content !== "string" || content.trim().length === 0) {
				this.logger.debug(
					"Skipping save: In-memory note content is empty or invalid."
				);
				return;
			}

			// Save content to data.json using Obsidian API
			const dataToSave = {
				...this.plugin.settings,
				noteContent: content,
				lastSaved: new Date().toISOString(),
			};

			await this.plugin.saveData(dataToSave);

			// Mark the view as saved since content was persisted
			view.markAsSaved();

			this.logger.debug(
				"Auto-saved note content to data.json using Obsidian API"
			);
		} catch (error) {
			this.logger.error(`Failed to auto-save note content: ${error}`);
		}
	}
}
