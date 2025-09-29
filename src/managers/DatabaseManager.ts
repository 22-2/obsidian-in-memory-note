import log from "loglevel";
import { debounce, type Debouncer } from "obsidian";
import type { AppEvents } from "src/events/AppEvents";
import type { DatabaseAPI } from "src/managers/DatabaseAPI";
import type { IManager } from "src/managers/IManager";
import type { EventEmitter } from "src/utils/EventEmitter";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";
import type { AbstractNoteView } from "src/views/internal/AbstractNoteView";
import type { CacheManager } from "./CacheManager";

const logger = log.getLogger("DatabaseController");

export class DatabaseManager implements IManager {
	private debouncedSaveFns = new Map<
		string,
		Debouncer<[string, string], void>
	>();

	constructor(
		private dbAPI: DatabaseAPI,
		private cache: {
			get: CacheManager["getNoteData"];
			set: CacheManager["updateNoteContent"];
			delete: CacheManager["deleteNoteData"];
		},
		private emitter: EventEmitter<AppEvents>
	) {}

	private sandboxGuard = (
		view: AbstractNoteView,
		callback: (view: HotSandboxNoteView & { masterNoteId: string }) => void
	) => {
		if (view instanceof HotSandboxNoteView && view.masterNoteId) {
			return callback(
				view! as HotSandboxNoteView & { masterNoteId: string }
			);
		}
	};

	private handleSaveRequest = (payload: AppEvents["save-requested"]) => {
		this.sandboxGuard(payload.view, (view) => {
			this.saveToDatabase(view.masterNoteId, view.getContent());
		});
	};

	private handleDeleteRequest = (payload: AppEvents["delete-requested"]) => {
		this.sandboxGuard(payload.view, (view) => {
			this.deleteFromDatabase(view.masterNoteId);
		});
	};

	async saveToDatabase(masterNoteId: string, content: string): Promise<void> {
		try {
			const note = this.cache.get(masterNoteId);
			if (note) {
				this.cache.set(masterNoteId, content);
				const updatedNote = this.cache.get(masterNoteId)!;

				await this.dbAPI.saveNote(updatedNote);
				logger.debug(`Saved hot note to database: ${masterNoteId}`);
				// this.emitter.emit("sandbox-note-saved", {
				// 	noteId: masterNoteId,
				// 	content,
				// });
			}
		} catch (error) {
			logger.error(
				`Failed to save note to database: ${masterNoteId}`,
				error
			);
			// this.emitter.emit("sandbox-note-save-failed", {
			// 	noteId: masterNoteId,
			// 	error,
			// });
		}
	}

	async deleteFromDatabase(masterNoteId: string): Promise<void> {
		try {
			await this.dbAPI.deleteNote(masterNoteId);
			this.cache.delete(masterNoteId);

			// デバウンサーもクリーンアップ
			this.debouncedSaveFns.delete(masterNoteId);

			logger.debug(`Deleted hot note from database: ${masterNoteId}`);
			// this.emitter.emit("sandbox-note-deleted", { noteId: masterNoteId });
		} catch (error) {
			logger.error(
				`Failed to delete note from database: ${masterNoteId}`,
				error
			);
			// this.emitter.emit("sandbox-note-delete-failed", {
			// 	noteId: masterNoteId,
			// 	error,
			// });
		}
	}

	private createDebouncedSave(
		masterNoteId: string,
		debounceMs: number
	): void {
		if (!this.debouncedSaveFns.has(masterNoteId)) {
			const debouncer = debounce(
				(id: string, content: string) => {
					this.saveToDatabase(id, content);
				},
				debounceMs,
				true
			);
			this.debouncedSaveFns.set(masterNoteId, debouncer);
		}
	}

	debouncedSaveSandbox(
		masterNoteId: string,
		content: string,
		debounceMs: number
	): void {
		this.createDebouncedSave(masterNoteId, debounceMs);
		const debouncer = this.debouncedSaveFns.get(masterNoteId)!;
		debouncer(masterNoteId, content);
	}

	load(): void {
		this.emitter.on("save-requested", this.handleSaveRequest);
		this.emitter.on("delete-requested", this.handleDeleteRequest);
	}

	unload(): void {
		this.dbAPI.close();
		this.debouncedSaveFns.clear();
		this.emitter.off("save-requested", this.handleSaveRequest);
		this.emitter.off("delete-requested", this.handleDeleteRequest);
	}
}
