import { SandboxNoteView } from "../SandboxNoteView";
import { debounce, type DebouncedFunction } from "../utils";
import type SandboxNotePlugin from "../main";
import type { DirectLogger } from "../utils/logging";

const SAVE_DEBOUNCE_DELAY = 1000;

/** Manages content persistence and auto-save functionality */
export class SaveManager {
	private plugin: SandboxNotePlugin;
	private logger: DirectLogger;
	private previousActiveView: SandboxNoteView | null = null;
	private isSaving = false;

	/** Debounced save function */
	debouncedSave: DebouncedFunction<
		(view: SandboxNoteView) => Promise<void>
	>;

	constructor(plugin: SandboxNotePlugin, logger: DirectLogger) {
		this.plugin = plugin;
		this.logger = logger;
		this.debouncedSave = debounce(
			(view: SandboxNoteView) => this.saveNoteContentToFile(view),
			SAVE_DEBOUNCE_DELAY
		);
	}

	/** Handle active leaf changes and auto-save if enabled */
	handleActiveLeafChange() {
		const activeView =
			this.plugin.app.workspace.getActiveViewOfType(SandboxNoteView);

		this.logger.debug(
			`Handling active leaf change. Previous: ${
				this.previousActiveView?.getViewType() ?? "none"
			}, Current: ${activeView?.getViewType() ?? "none"}`
		);

		// Auto-save content from previous view when save setting is enabled
		if (
			this.plugin.settings.enableSaveNoteContent &&
			this.previousActiveView
		) {
			this.logger.debug(
				`Triggering save for previous view: ${this.previousActiveView.getViewType()}`
			);
			this.saveNoteContentToFile(this.previousActiveView);
		}

		this.previousActiveView = activeView;
	}

	/** Save note content to data.json using Obsidian API */
	async saveNoteContentToFile(view: SandboxNoteView) {
		// Once a save is in progress, cancel any other debounced saves
		this.debouncedSave.cancel();

		this.logger.debug(`Save triggered for view: ${view.getViewType()}`);
		try {
			if (this.isSaving) {
				this.logger.debug(
					"Skipping save: A save is already in progress."
				);
				return;
			}
			this.isSaving = true;
			const content = view.wrapper.getContent();

			// Skip saving if content is invalid
			if (typeof content !== "string") {
				this.logger.debug(
					"Skipping save: Sandbox note content is invalid."
				);
				return;
			}

			// Also update the in-memory settings to keep them in sync
			this.plugin.settings.noteContent = content;
			this.plugin.settings.lastSaved = new Date().toISOString();

			// Save content to data.json using Obsidian API
			await this.plugin.saveData(this.plugin.settings);

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
