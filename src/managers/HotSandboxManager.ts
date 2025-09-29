import log from "loglevel";
import { debounce, type Debouncer } from "obsidian";
import type { HotSandboxNoteData } from "src/settings";
import type { EventEmitter } from "src/utils/EventEmitter";
import type { AppEvents } from "src/events/AppEvents";
import type { DatabaseAPI } from "./DatabaseAPI";

const logger = log.getLogger("HotSandboxManager");

export class HotSandboxManager {
	private emitter: EventEmitter<AppEvents>;
	private databaseAPI: DatabaseAPI;
	private hotNotes = new Map<string, HotSandboxNoteData>();
	private debouncedSaveFns = new Map<
		string,
		Debouncer<[string, string], void>
	>();

	constructor(emitter: EventEmitter<AppEvents>, databaseAPI: DatabaseAPI) {
		this.emitter = emitter;
		this.databaseAPI = databaseAPI;
	}

	async initialize(): Promise<void> {
		const allNotes = await this.databaseAPI.getAllNotes();
		this.hotNotes.clear();

		allNotes.forEach((note) => {
			this.hotNotes.set(note.id, note);
		});

		logger.debug(
			`Loaded ${allNotes.length} hot sandbox notes into memory.`
		);
		// this.emitter.emit("notes-loaded", { count: allNotes.length });
	}

	getAllNotes(): HotSandboxNoteData[] {
		return Array.from(this.hotNotes.values());
	}

	getNoteContent(masterNoteId: string): string {
		return this.hotNotes.get(masterNoteId)?.content ?? "";
	}

	getNoteData(masterNoteId: string): HotSandboxNoteData | undefined {
		return this.hotNotes.get(masterNoteId);
	}

	registerNewNote(masterNoteId: string): void {
		if (!this.hotNotes.has(masterNoteId)) {
			const newNote: HotSandboxNoteData = {
				id: masterNoteId,
				content: "",
				mtime: Date.now(),
			};
			this.hotNotes.set(masterNoteId, newNote);
			logger.debug(`Registered new note: ${masterNoteId}`);
			// this.emitter.emit("hot-note-registered", { noteId: masterNoteId });
		}
	}

	updateNoteContent(masterNoteId: string, content: string): void {
		const note = this.hotNotes.get(masterNoteId);
		if (note) {
			note.content = content;
			note.mtime = Date.now();
			// this.emitter.emit("hot-note-content-updated", {
			// 	noteId: masterNoteId,
			// 	content,
			// });
		}
	}

	async saveToDatabase(masterNoteId: string, content: string): Promise<void> {
		try {
			const note = this.hotNotes.get(masterNoteId);
			if (note) {
				this.updateNoteContent(masterNoteId, content);
				const updatedNote = this.hotNotes.get(masterNoteId)!;

				await this.databaseAPI.saveNote(updatedNote);
				logger.debug(`Saved hot note to database: ${masterNoteId}`);
				// this.emitter.emit("hot-note-saved", {
				// 	noteId: masterNoteId,
				// 	content,
				// });
			}
		} catch (error) {
			logger.error(
				`Failed to save note to database: ${masterNoteId}`,
				error
			);
			// this.emitter.emit("hot-note-save-failed", {
			// 	noteId: masterNoteId,
			// 	error,
			// });
		}
	}

	async deleteFromDatabase(masterNoteId: string): Promise<void> {
		try {
			await this.databaseAPI.deleteNote(masterNoteId);
			this.hotNotes.delete(masterNoteId);

			// デバウンサーもクリーンアップ
			this.debouncedSaveFns.delete(masterNoteId);

			logger.debug(`Deleted hot note from database: ${masterNoteId}`);
			// this.emitter.emit("hot-note-deleted", { noteId: masterNoteId });
		} catch (error) {
			logger.error(
				`Failed to delete note from database: ${masterNoteId}`,
				error
			);
			// this.emitter.emit("hot-note-delete-failed", {
			// 	noteId: masterNoteId,
			// 	error,
			// });
		}
	}

	createDebouncedSave(masterNoteId: string, debounceMs: number): void {
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

	debouncedSave(
		masterNoteId: string,
		content: string,
		debounceMs: number
	): void {
		this.createDebouncedSave(masterNoteId, debounceMs);
		const debouncer = this.debouncedSaveFns.get(masterNoteId)!;
		debouncer(masterNoteId, content);
	}

	cleanup(): void {
		this.debouncedSaveFns.clear();
		this.hotNotes.clear();
		this.databaseAPI.close();
	}
}
