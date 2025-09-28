import log from "loglevel";
import { debounce, type Debouncer } from "obsidian";
import type { AppEvents } from "src/events/AppEvents";
import type SandboxNotePlugin from "src/main";
import type {
	HotSandboxNoteData,
	PluginSettings,
	SandboxNotePluginData,
} from "src/settings";
import { DEFAULT_PLUGIN_DATA } from "src/utils/constants";
import type { EventEmitter } from "src/utils/EventEmitter";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";
import type { DatabaseManager } from "./DatabaseManager";
import type { Manager } from "./Manager";

/** Manages all plugin state, including settings and note data. Acts as a single source of truth. */
export class StateManager implements Manager {
	private plugin: SandboxNotePlugin;
	private emitter: EventEmitter<AppEvents>;
	private databaseManager: DatabaseManager;

	private data: SandboxNotePluginData = DEFAULT_PLUGIN_DATA;

	private debouncedHotSaveFns = new Map<
		string,
		Debouncer<[string, string], void>
	>();

	constructor(
		plugin: SandboxNotePlugin,
		emitter: EventEmitter<AppEvents>,
		databaseManager: DatabaseManager
	) {
		this.plugin = plugin;
		this.emitter = emitter;
		this.databaseManager = databaseManager;
	}

	async load() {
		// Load settings from Obsidian's storage
		const loadedData = await this.plugin.loadData();
		this.data = Object.assign({}, DEFAULT_PLUGIN_DATA, loadedData);

		// Load hot notes from IndexedDB into the state
		const allNotes = await this.databaseManager.getAllNotes();
		this.data.data.hotSandboxNotes = allNotes.reduce((acc, note) => {
			acc[note.id] = note;
			return acc;
		}, {} as Record<string, HotSandboxNoteData>);

		log.debug(`Restored ${allNotes.length} hot sandbox notes into state.`);

		this.emitter.on("save-requested", this.handleSaveRequest);
		this.emitter.on(
			"editor-content-changed",
			this.handleEditorContentChanged
		);
	}

	unload() {
		this.emitter.off("save-requested", this.handleSaveRequest);
		this.emitter.off(
			"editor-content-changed",
			this.handleEditorContentChanged
		);
	}

	// --- Settings Management ---

	getSettings(): PluginSettings {
		return this.data.settings;
	}

	async updateSettings(settings: PluginSettings) {
		this.data.settings = settings;
		await this.plugin.saveData(this.data);
		this.emitter.emit("settings-changed", { newSettings: settings });
	}

	// --- Hot Note Data Management ---

	getAllHotNotes(): HotSandboxNoteData[] {
		return Object.values(this.data.data.hotSandboxNotes);
	}

	getHotNoteContent(masterNoteId: string): string {
		return this.data.data.hotSandboxNotes[masterNoteId]?.content ?? "";
	}

	registerNewHotNote(masterNoteId: string) {
		if (!this.data.data.hotSandboxNotes[masterNoteId]) {
			this.data.data.hotSandboxNotes[masterNoteId] = {
				id: masterNoteId,
				content: "",
				mtime: Date.now(),
			};
			log.debug(`Registered new hot note in state: ${masterNoteId}`);
		}
	}

	updateHotNoteContent(masterNoteId: string, content: string) {
		const note = this.data.data.hotSandboxNotes[masterNoteId];
		if (note) {
			note.content = content;
			note.mtime = Date.now();
		}
	}

	async saveHotNoteToDb(masterNoteId: string, content: string) {
		this.updateHotNoteContent(masterNoteId, content);
		try {
			const noteToSave = this.data.data.hotSandboxNotes[masterNoteId];
			if (noteToSave) {
				await this.databaseManager.saveNote(noteToSave);
				log.debug(
					`Saved hot sandbox note to IndexedDB: ${masterNoteId}`
				);
			}
		} catch (error) {
			log.error(
				`Failed to save hot sandbox note to DB ${masterNoteId}:`,
				error
			);
		}
	}

	private debouncedSaveHotNoteToDb(masterNoteId: string, content: string) {
		let debouncer = this.debouncedHotSaveFns.get(masterNoteId);
		if (!debouncer) {
			debouncer = debounce(
				(id: string, newContent: string) => {
					this.saveHotNoteToDb(id, newContent);
				},
				this.getSettings().autoSaveDebounceMs,
				true
			);
			this.debouncedHotSaveFns.set(masterNoteId, debouncer);
		}
		debouncer(masterNoteId, content);
	}

	// --- Event Handlers ---

	private handleSaveRequest = (payload: AppEvents["save-requested"]) => {
		const { view } = payload;
		if (view instanceof HotSandboxNoteView && view.masterNoteId) {
			this.saveHotNoteToDb(view.masterNoteId, view.getContent());
		}
	};

	private handleEditorContentChanged = (
		payload: AppEvents["editor-content-changed"]
	) => {
		const { content, sourceView } = payload;

		if (
			sourceView instanceof HotSandboxNoteView &&
			sourceView.masterNoteId
		) {
			// Update in-memory state first
			// this.updateHotNoteContent(sourceView.masterNoteId, content);

			// Then, trigger debounced save if auto-save is enabled
			if (this.getSettings().enableAutoSave) {
				this.debouncedSaveHotNoteToDb(sourceView.masterNoteId, content);
			}
		}
	};
}
