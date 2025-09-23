import { SandboxNoteView } from "../views/SandboxNoteView";
import { debounce, type DebouncedFunction } from "../utils";
import type SandboxNotePlugin from "../main";
import log from "loglevel";

const SAVE_DEBOUNCE_DELAY = 1000;

/** Manages content persistence and auto-save functionality */
export class SaveManager {
	private plugin: SandboxNotePlugin;
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

	/**
	 * Save note content to data.json after performing necessary checks.
	 * This method orchestrates the save operation.
	 */
	async saveNoteContentToFile(view: SandboxNoteView) {
		// Cancel any pending debounced save
		this.debouncedSave.cancel();

		// Check if a save operation can be performed
		if (!this.canSave(view)) {
			return;
		}

		// content is validated in canSave, so we can assert the type
		const content = view.wrapper.getContent() as string;

		log.debug(`Save triggered for view: ${view.getViewType()}`);
		try {
			this.isSaving = true;
			// Perform the actual persistence
			await this.persistContent(content, view);
		} catch (error) {
			log.error(`Failed to auto-save note content: ${error}`);
		} finally {
			this.isSaving = false;
		}
	}

	/**
	 * Checks if the content of the view can be saved.
	 * @param view The view to check.
	 * @returns True if saving is possible, false otherwise.
	 */
	private canSave(view: SandboxNoteView): boolean {
		// Skip if a save is already in progress
		if (this.isSaving) {
			log.debug("Skipping save: A save is already in progress.");
			return false;
		}

		// Skip if the content is invalid
		const content = view.wrapper.getContent();
		if (typeof content !== "string") {
			log.debug("Skipping save: Sandbox note content is invalid.");
			return false;
		}

		return true;
	}

	/**
	 * Persists the given content to the plugin's data file and updates the view state.
	 * @param content The content to save.
	 * @param view The view to mark as saved.
	 */
	private async persistContent(
		content: string,
		view: SandboxNoteView
	): Promise<void> {
		// Also update the in-memory settings to keep them in sync
		this.plugin.settings.noteContent = content;
		this.plugin.settings.lastSaved = new Date().toISOString();

		// Save content to data.json using Obsidian API
		await this.plugin.saveData(this.plugin.settings);

		// Mark the view as saved since content was persisted
		view.markAsSaved();

		log.debug("Auto-saved note content to data.json using Obsidian API");
	}
}
