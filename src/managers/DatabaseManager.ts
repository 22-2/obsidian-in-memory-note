import log from "loglevel";
import { debounce, type Debouncer } from "obsidian";
import type { AppEvents } from "src/events/AppEvents";
import type { DatabaseAPI } from "src/managers/DatabaseAPI";
import type { IManager } from "src/managers/IManager";
import type { EventEmitter } from "src/utils/EventEmitter";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";
import type { AbstractNoteView } from "src/views/internal/AbstractNoteView";
import invariant from "tiny-invariant";
import type { CacheManager } from "./CacheManager";
import type { ViewManager } from "./ViewManager";

const logger = log.getLogger("DatabaseController");

const MAX_RETRY_ATTEMPTS = 3;

type Context = {
	dbAPI: DatabaseAPI;
	cache: {
		get: CacheManager["get"];
		set: CacheManager["updateSandboxContent"];
		delete: CacheManager["delete"];
	};
	emitter: EventEmitter<AppEvents>;
	getAllHotSandboxViews: ViewManager["getAllViews"];
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
		this.sandboxGuard(payload.view, async (view) => {
			await this.saveToDatabase(view.masterId, view.getContent())
				.then(() => {
					this.context.emitter.emit("save-result", {
						view,
						success: true,
					});
				})
				.catch(() => {
					this.context.emitter.emit("save-result", {
						view,
						success: false,
					});
				});
		});
	};

	private handleDeleteRequest = (payload: AppEvents["delete-requested"]) => {
		this.sandboxGuard(payload.view, (view) => {
			this.deleteFromAll(view.masterId);
		});
	};

	getAllSandboxes() {
		return this.context.dbAPI.getAllSandboxes();
	}

	private async saveToDatabase(
		masterId: string,
		content: string
	): Promise<void> {
		const note = this.context.cache.get(masterId);
		if (!note) {
			return;
		}

		this.context.cache.set(masterId, content);
		const updatedNote = this.context.cache.get(masterId)!;

		for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
			try {
				await this.context.dbAPI.saveSandbox(updatedNote);
				logger.debug(`Saved hot note to database: ${masterId} (attempt ${attempt})`);
				return;
			} catch (error) {
				if (attempt === MAX_RETRY_ATTEMPTS) {
					logger.warn(`Failed to save note to database after ${MAX_RETRY_ATTEMPTS} attempts: ${masterId}`, error);
					throw error;
				}
				logger.debug(`Save attempt ${attempt} failed for ${masterId}, retrying...`);
			}
		}
	}

	async deleteFromAll(masterId: string | null): Promise<void> {
		try {
			invariant(masterId, "Invalid masterId");
			await this.context.dbAPI.deleteSandbox(masterId);
			this.context.cache.delete(masterId);
			this.debouncedSaveFns.delete(masterId);
			logger.debug(`Deleted hot note from database: ${masterId}`);
			// this.context.emitter.emit("sandbox-note-deleted", { noteId: masterId });
		} catch (error) {
			logger.error(
				`Failed to delete note from database: ${masterId}`,
				error
			);
			// this.context.emitter.emit("sandbox-note-delete-failed", {
			// 	noteId: masterId,
			// 	error,
			// });
		}
	}

	private createDebouncedSave(masterId: string, debounceMs: number): void {
		if (!this.debouncedSaveFns.has(masterId)) {
			const debouncer = debounce(
				(id: string, content: string) => {
					this.saveToDatabase(id, content);
				},
				debounceMs,
				true
			);
			this.debouncedSaveFns.set(masterId, debouncer);
		}
	}

	async clearAllDeadSandboxes() {
		const savedSandboxes = await this.context.dbAPI.getAllSandboxes();
		const allViews = this.context.getAllHotSandboxViews();
		for (const sandbox of savedSandboxes) {
			const view = allViews.find((view) => view.masterId === sandbox.id);
			if (!view?.masterId) this.deleteFromAll(sandbox.id);
		}
		logger.debug("clear all dead sandboxes");
	}

	getSandboxByMasterId(masterId: string) {
		return this.context.dbAPI.getSandbox(masterId);
	}

	debouncedSaveSandboxes(
		masterId: string,
		content: string,
		debounceMs: number
	): void {
		this.createDebouncedSave(masterId, debounceMs);
		const debouncer = this.debouncedSaveFns.get(masterId)!;
		debouncer(masterId, content);
	}

	/**
	 * Immediately saves sandbox content without debouncing.
	 * Used for critical events like view close or plugin unload.
	 * @param masterId - The master ID of the sandbox
	 * @param content - The content to save
	 */
	async immediateSave(masterId: string, content: string): Promise<void> {
		logger.debug(`Immediate save requested for: ${masterId}`);
		await this.saveToDatabase(masterId, content);
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
