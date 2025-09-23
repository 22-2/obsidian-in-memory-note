import type { AppEvents } from "../events/AppEvents";
import type { EventEmitter } from "../utils/EventEmitter";
import type { EditorSyncManager } from "./EditorSyncManager";
import type { SaveManager } from "./SaveManager";

export class EventManager {
	private emitter: EventEmitter<AppEvents>;

	constructor(emitter: EventEmitter<AppEvents>) {
		this.emitter = emitter;
	}

	public registerEventHandlers(
		editorSyncManager: EditorSyncManager,
		saveManager: SaveManager
	): void {
		// When content changes, sync it
		this.emitter.on("content-changed", (payload) => {
			editorSyncManager.syncAll(payload.content, payload.sourceView);
		});

		// When a save is requested, save it
		this.emitter.on("save-requested", (payload) => {
			saveManager.saveNoteContentToFile(payload.view);
		});

		// When content is saved, mark it as saved
		this.emitter.on("content-saved", () => {
			editorSyncManager.markAsSaved();
		});

		// When unsaved state changes, refresh views
		this.emitter.on("unsaved-state-changed", () => {
			editorSyncManager.refreshAllViewTitles();
			editorSyncManager.refreshAllViewActionButtons();
		});
	}
}
