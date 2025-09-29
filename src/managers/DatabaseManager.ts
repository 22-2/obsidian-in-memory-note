import log from "loglevel";
import { debounce, type Debouncer } from "obsidian";
import type { AppEvents } from "src/events/AppEvents";
import type { DatabaseAPI } from "src/managers/DatabaseAPI";
import type { IManager } from "src/managers/IManager";
import type { EventEmitter } from "src/utils/EventEmitter";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";
import type { AbstractNoteView } from "src/views/internal/AbstractNoteView";
import type { CacheManager } from "./CacheManager";
import type { ViewManager } from "./ViewManager";

const logger = log.getLogger("DatabaseController");

type Context = {
	dbAPI: DatabaseAPI;
	cache: {
		get: CacheManager["get"];
		set: CacheManager["updateNoteContent"];
		delete: CacheManager["delete"];
	};
	emitter: EventEmitter<AppEvents>;
	getAllHotSandboxViews: ViewManager["getAllHotSandboxViews"];
};

export class DatabaseManager implements IManager {
	private debouncedSaveFns = new Map<
		string,
		Debouncer<[string, string], void>
	>();

	constructor(private context: Context) {}

	private sandboxGuard = (
		view: AbstractNoteView,
		callback: (view: HotSandboxNoteView & { masterId: string }) => void
	) => {
		if (view instanceof HotSandboxNoteView && view.masterId) {
			return callback(view! as HotSandboxNoteView & { masterId: string });
		}
	};

	private handleSaveRequest = (payload: AppEvents["save-requested"]) => {
		this.sandboxGuard(payload.view, (view) => {
			this.saveToDatabase(view.masterId, view.getContent());
		});
	};

	private handleDeleteRequest = (payload: AppEvents["delete-requested"]) => {
		this.sandboxGuard(payload.view, (view) => {
			this.deleteFromDatabase(view.masterId);
		});
	};

	getAllSandboxes() {
		return this.context.dbAPI.getAllSandboxes();
	}

	async saveToDatabase(masterNoteId: string, content: string): Promise<void> {
		try {
			const note = this.context.cache.get(masterNoteId);
			if (note) {
				this.context.cache.set(masterNoteId, content);
				const updatedNote = this.context.cache.get(masterNoteId)!;

				await this.context.dbAPI.saveSandbox(updatedNote);
				logger.debug(`Saved hot note to database: ${masterNoteId}`);
				// this.context.emitter.emit("sandbox-note-saved", {
				// 	noteId: masterNoteId,
				// 	content,
				// });
			}
		} catch (error) {
			logger.error(
				`Failed to save note to database: ${masterNoteId}`,
				error
			);
			// this.context.emitter.emit("sandbox-note-save-failed", {
			// 	noteId: masterNoteId,
			// 	error,
			// });
		}
	}

	async deleteFromDatabase(masterNoteId: string): Promise<void> {
		try {
			await this.context.dbAPI.deleteSandbox(masterNoteId);
			this.context.cache.delete(masterNoteId);

			// デバウンサーもクリーンアップ
			this.debouncedSaveFns.delete(masterNoteId);

			logger.debug(`Deleted hot note from database: ${masterNoteId}`);
			// this.context.emitter.emit("sandbox-note-deleted", { noteId: masterNoteId });
		} catch (error) {
			logger.error(
				`Failed to delete note from database: ${masterNoteId}`,
				error
			);
			// this.context.emitter.emit("sandbox-note-delete-failed", {
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

	async clearAllDeadSadboxes() {
		const savedSandboxes = await this.context.dbAPI.getAllSandboxes();
		const allViews = this.context.getAllHotSandboxViews();
		for (const sandbox of savedSandboxes) {
			const view = allViews.find((view) => view.masterId === sandbox.id);
			if (view?.masterId) this.deleteFromAll(view.masterId);
		}
	}

	async deleteFromAll(masterId: string) {
		this.context.cache.delete(masterId);
		this.debouncedSaveFns.delete(masterId);
		await this.context.dbAPI.deleteSandbox(masterId);
	}

	getSandboxByMasterId(masterNoteId: string) {
		return this.context.dbAPI.getSandbox(masterNoteId);
	}

	debouncedSaveSandboxes(
		masterNoteId: string,
		content: string,
		debounceMs: number
	): void {
		this.createDebouncedSave(masterNoteId, debounceMs);
		const debouncer = this.debouncedSaveFns.get(masterNoteId)!;
		debouncer(masterNoteId, content);
	}

	load(): void {
		this.context.emitter.on("save-requested", this.handleSaveRequest);
		this.context.emitter.on("delete-requested", this.handleDeleteRequest);
	}

	unload(): void {
		this.context.dbAPI.close();
		this.debouncedSaveFns.clear();
		this.context.emitter.off("save-requested", this.handleSaveRequest);
		this.context.emitter.off("delete-requested", this.handleDeleteRequest);
	}
}
