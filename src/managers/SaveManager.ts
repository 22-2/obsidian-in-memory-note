import { SandboxNoteView } from "../views/SandboxNoteView";
import log from "loglevel";
import type { EventEmitter } from "src/utils/EventEmitter";
import type { AppEvents } from "src/events/AppEvents";
import type { SandboxNotePluginData, PluginSettings } from "src/settings";
import { debounce, type Debouncer } from "obsidian";
import type { Manager } from "./Manager";
import type { DatabaseManager } from "./DatabaseManager";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";

/** Manages content persistence and auto-save functionality */
export class SaveManager implements Manager {
	private emitter: EventEmitter<AppEvents>;
	private data: SandboxNotePluginData;
	private saveData: (data: SandboxNotePluginData) => Promise<void>;
	private databaseManager: DatabaseManager;
	private isSaving = false;

	// --- Properties moved from EditorSyncManager ---
	private lastSavedContent = "";
	public hasUnsavedChanges = false;
	// ---------------------------------------------

	/** Debounced save function */
	debouncedSave: Debouncer<[SandboxNoteView], Promise<void>>;

	private debouncedHotSaveFns = new Map<
		string,
		Debouncer<[string, string], void>
	>();

	constructor(
		emitter: EventEmitter<AppEvents>,
		data: SandboxNotePluginData,
		saveData: (data: SandboxNotePluginData) => Promise<void>,
		databaseManager: DatabaseManager
	) {
		this.emitter = emitter;
		this.data = data;
		this.saveData = saveData;
		this.databaseManager = databaseManager;

		// Initialize saved content state
		this.lastSavedContent = data.data.noteContent ?? "";

		this.debouncedSave = debounce(
			(view: SandboxNoteView) => this.saveNoteContentToFile(view),
			this.data.settings.autoSaveDebounceMs
		);
	}

	public load(): void {
		this.emitter.on("save-requested", this.handleSaveRequest);
		this.emitter.on(
			"editor-content-changed",
			this.handleEditorContentChanged
		);
	}

	public unload(): void {
		this.emitter.off("save-requested", this.handleSaveRequest);
		this.emitter.off(
			"editor-content-changed",
			this.handleEditorContentChanged
		);
	}

	private handleSaveRequest = (payload: AppEvents["save-requested"]) => {
		const { view } = payload;
		if (view instanceof HotSandboxNoteView && view.noteGroupId) {
			this.saveHotNoteContent(view.noteGroupId, view.getContent());
		} else if (view instanceof SandboxNoteView) {
			this.saveNoteContentToFile(view);
		}
	};

	private handleEditorContentChanged = (
		payload: AppEvents["editor-content-changed"]
	) => {
		const { content, sourceView } = payload;

		if (sourceView instanceof SandboxNoteView) {
			this.updateUnsavedState(content);
			if (this.data.settings.enableAutoSave) {
				this.debouncedSave(sourceView);
			}
		} else if (
			sourceView instanceof HotSandboxNoteView &&
			sourceView.noteGroupId
		) {
			// Only trigger auto-save for hot notes, no separate unsaved state management for them yet.
			if (this.data.settings.enableAutoSave) {
				this.debouncedHotSave(sourceView.noteGroupId, content);
			}
		}
	};

	// --- Original SandboxNote methods ---
	/**
	 * Save note content to data.json after performing necessary checks.
	 * This method orchestrates the save operation.
	 */
	async saveNoteContentToFile(view: SandboxNoteView) {
		this.debouncedSave.cancel();

		if (!this.canSave(view)) {
			return;
		}

		const content = view.wrapper.getContent();
		log.debug(`Save triggered for view: ${view.getViewType()}`);

		try {
			this.isSaving = true;
			await this.persistContent(content, view);
		} catch (error) {
			log.error(`Failed to auto-save note content: ${error}`);
		} finally {
			this.isSaving = false;
		}
	}

	private canSave(view: SandboxNoteView): boolean {
		if (this.isSaving) {
			log.debug("Skipping save: A save is already in progress.");
			return false;
		}
		return true;
	}

	private async persistContent(
		content: string,
		view: SandboxNoteView
	): Promise<void> {
		this.data.data.noteContent = content;
		this.data.data.lastSaved = new Date().toISOString();

		await this.saveData(this.data);
		this.emitter.emit("content-saved", { view });
		this.markAsSaved(content); // Update saved state after successful save

		log.debug("Auto-saved note content to data.json using Obsidian API");
	}

	async saveSettings(
		pluginSettings: PluginSettings,
		noteContentBody: {
			noteContent: string;
		}
	) {
		this.data.settings = pluginSettings;
		this.data.data.noteContent = noteContentBody.noteContent;
		await this.saveData(this.data);
	}

	// --- Methods moved from EditorSyncManager ---
	private updateUnsavedState(currentContent: string) {
		const wasUnsaved = this.hasUnsavedChanges;
		this.hasUnsavedChanges = currentContent !== this.lastSavedContent;

		if (wasUnsaved !== this.hasUnsavedChanges) {
			log.debug(`Unsaved state changed to: ${this.hasUnsavedChanges}`);
			this.emitter.emit("unsaved-state-changed", {
				hasUnsavedChanges: this.hasUnsavedChanges,
			});
		}
	}

	private markAsSaved(savedContent: string) {
		this.lastSavedContent = savedContent;
		this.updateUnsavedState(savedContent);
		log.debug("Content marked as saved.");
	}
	// ---------------------------------------------

	// --- HotSandboxNote methods ---

	public async saveHotNoteContent(noteGroupId: string, content: string) {
		try {
			await this.databaseManager.saveNote({
				id: noteGroupId,
				content,
				mtime: Date.now(),
			});
			log.debug(
				`Saved hot sandbox note content to IndexedDB for group: ${noteGroupId}`
			);
		} catch (error) {
			log.error(
				`Failed to save hot sandbox note content for group ${noteGroupId}:`,
				error
			);
		}
	}

	public debouncedHotSave(noteGroupId: string, content: string) {
		let debouncer = this.debouncedHotSaveFns.get(noteGroupId);
		if (!debouncer) {
			debouncer = debounce(
				(id: string, newContent: string) => {
					this.saveHotNoteContent(id, newContent);
				},
				this.data.settings.autoSaveDebounceMs,
				true
			);
			this.debouncedHotSaveFns.set(noteGroupId, debouncer);
		}
		debouncer(noteGroupId, content);
	}
}
