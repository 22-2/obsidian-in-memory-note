import { SandboxNoteView } from "../views/SandboxNoteView";
import log from "loglevel";
import type { EventEmitter } from "src/utils/EventEmitter";
import type { AppEvents } from "src/events/AppEvents";
import type { PluginData, SandboxNotePluginSettings } from "src/settings";
import { debounce, Notice, type Debouncer } from "obsidian";
/** Manages content persistence and auto-save functionality */
export class SaveManager {
	private emitter: EventEmitter<AppEvents>;
	private data: PluginData;
	private saveData: (data: PluginData) => Promise<void>;
	private isSaving = false;

	/** Debounced save function */
	debouncedSave: Debouncer<[SandboxNoteView], Promise<void>>;

	constructor(
		emitter: EventEmitter<AppEvents>,
		data: PluginData,
		saveData: (data: PluginData) => Promise<void>
	) {
		this.emitter = emitter;
		this.data = data;
		this.saveData = saveData;
		this.debouncedSave = debounce(
			(view: SandboxNoteView) => this.saveNoteContentToFile(view),
			this.data.settings.autoSaveDebounceMs
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
			await this.persistContent(content);
		} catch (error) {
			log.error(`Failed to auto-save note content: ${error}`);
			new Notice("Failed to auto-save note content.");
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
	 */
	private async persistContent(content: string): Promise<void> {
		// Also update the in-memory settings to keep them in sync
		this.data.data.noteContent = content;
		this.data.data.lastSaved = new Date().toISOString();

		// Save content to data.json using Obsidian API
		await this.saveData(this.data);

		// Mark the content as saved in the central manager
		this.emitter.emit("content-saved", undefined);

		log.debug("Auto-saved note content to data.json using Obsidian API");
	}
}
