import { SandboxNoteView } from "../SandboxNoteView";
import type SandboxNotePlugin from "../main";
import type { DirectLogger } from "../utils/logging";

/** Manages content persistence and auto-save functionality */
export class SaveManager {
	private plugin: SandboxNotePlugin;
	private logger: DirectLogger;
	private previousActiveView: SandboxNoteView | null = null;
	private isSaving = false;

	constructor(plugin: SandboxNotePlugin, logger: DirectLogger) {
		this.plugin = plugin;
		this.logger = logger;
	}

	/** Handle active leaf changes and auto-save if enabled */
	handleActiveLeafChange() {
		const activeView =
			this.plugin.app.workspace.getActiveViewOfType(SandboxNoteView);

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
	async saveNoteContentToFile(view: SandboxNoteView) {
		try {
			if (this.isSaving) {
				this.logger.debug(
					"Skipping save: A save is already in progress."
				);
				return;
			}
			this.isSaving = true;
			const content = view.sandboxEditor.getContent();

			// Skip saving if content is invalid
			if (typeof content !== "string") {
				this.logger.debug(
					"Skipping save: Sandbox note content is invalid."
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
		} finally {
			this.isSaving = false;
		}
	}
}
