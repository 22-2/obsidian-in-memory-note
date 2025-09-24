import type { AppEvents } from "../events/AppEvents";
import type { PluginSettings } from "../settings";
import { SandboxNoteView } from "../views/SandboxNoteView";
import type { EventEmitter } from "../utils/EventEmitter";
import type { EditorSyncManager } from "./EditorSyncManager";
import type { SaveManager } from "./SaveManager";
import type { Manager } from "./Manager";

export class EventManager implements Manager {
	private emitter: EventEmitter<AppEvents>;
	private editorSyncManager: EditorSyncManager;
	private saveManager: SaveManager;
	private settings: PluginSettings;

	private onContentChanged = (payload: AppEvents["content-changed"]) => {
		this.editorSyncManager.syncAll(payload.content, payload.sourceView);

		if (
			this.settings.enableAutoSave &&
			payload.sourceView instanceof SandboxNoteView
		) {
			this.saveManager.debouncedSave(payload.sourceView);
		}
	};

	private onSaveRequested = (payload: AppEvents["save-requested"]) => {
		this.saveManager.saveNoteContentToFile(payload.view);
	};

	private onContentSaved = () => {
		this.editorSyncManager.markAsSaved();
	};

	private onUnsavedStateChanged = () => {
		this.editorSyncManager.refreshAllViewTitles();
		this.editorSyncManager.refreshAllViewActionButtons();
	};

	constructor(
		emitter: EventEmitter<AppEvents>,
		editorSyncManager: EditorSyncManager,
		saveManager: SaveManager,
		settings: PluginSettings
	) {
		this.emitter = emitter;
		this.editorSyncManager = editorSyncManager;
		this.saveManager = saveManager;
		this.settings = settings;
	}

	public load(): void {
		this.emitter.on("content-changed", this.onContentChanged);
		this.emitter.on("save-requested", this.onSaveRequested);
		this.emitter.on("content-saved", this.onContentSaved);
		this.emitter.on("unsaved-state-changed", this.onUnsavedStateChanged);
	}

	public unload(): void {
		this.emitter.off("content-changed", this.onContentChanged);
		this.emitter.off("save-requested", this.onSaveRequested);
		this.emitter.off("content-saved", this.onContentSaved);
		this.emitter.off("unsaved-state-changed", this.onUnsavedStateChanged);
	}
}
