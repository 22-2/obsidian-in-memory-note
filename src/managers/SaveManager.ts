import { SandboxNoteView } from "../views/SandboxNoteView";
import { debounce, type DebouncedFunction } from "../utils";
import type SandboxNotePlugin from "../main";
import log from "loglevel";

const SAVE_DEBOUNCE_DELAY = 1000;

/** Manages content persistence and auto-save functionality */
export class AutoSaveHandler {
	private plugin: SandboxNotePlugin;
	private previousActiveView: SandboxNoteView | null = null;
	private isSaving = false;

	/** Debounced save function */
	debouncedSave: DebouncedFunction<(view: SandboxNoteView) => Promise<void>>;

	constructor(plugin: SandboxNotePlugin) {
		this.plugin = plugin;
		this.debouncedSave = debounce(
			(view: SandboxNoteView) => this.saveNoteContentToFile(view),
			SAVE_DEBOUNCE_DELAY
		);
	}

	/** Handle active leaf changes and auto-save if enabled */
	handleActiveLeafChange() {
		const activeView =
			this.plugin.app.workspace.getActiveViewOfType(SandboxNoteView);

		log.debug(
			`Handling active leaf change. Previous: ${
				this.previousActiveView?.getViewType() ?? "none"
			}, Current: ${activeView?.getViewType() ?? "none"}`
		);

		// Auto-save content from previous view when save setting is enabled
		if (
			this.plugin.settings.enableSaveNoteContent &&
			this.previousActiveView
		) {
			log.debug(
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

		log.debug(`Save triggered for view: ${view.getViewType()}`);
		try {
			if (this.isSaving) {
				log.debug("Skipping save: A save is already in progress.");
				return;
			}
			this.isSaving = true;
			const content = view.wrapper.getContent();

			// Skip saving if content is invalid
			if (typeof content !== "string") {
				log.debug("Skipping save: Sandbox note content is invalid.");
				return;
			}

			// Also update the in-memory settings to keep them in sync
			this.plugin.settings.noteContent = content;
			this.plugin.settings.lastSaved = new Date().toISOString();

			// Save content to data.json using Obsidian API
			await this.plugin.saveData(this.plugin.settings);

			// Mark the view as saved since content was persisted
			view.markAsSaved();

			log.debug(
				"Auto-saved note content to data.json using Obsidian API"
			);
		} catch (error) {
			log.error(`Failed to auto-save note content: ${error}`);
		} finally {
			this.isSaving = false;
		}
	}
}
