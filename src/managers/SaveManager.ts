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
		}
	};

	private handleEditorContentChanged = (
		payload: AppEvents["editor-content-changed"]
	) => {
		const { content, sourceView } = payload;

		if (
			sourceView instanceof HotSandboxNoteView &&
			sourceView.noteGroupId
		) {
			// Only trigger auto-save for hot notes, no separate unsaved state management for them yet.
			if (this.data.settings.enableAutoSave) {
				this.debouncedHotSave(sourceView.noteGroupId, content);
			}
		}
	};

	async saveSettings(pluginSettings: PluginSettings) {
		this.data.settings = pluginSettings;
		await this.saveData(this.data);
	}

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
