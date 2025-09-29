import log from "loglevel";
import type { AppEvents } from "src/events/AppEvents";
import type { HotSandboxNoteData } from "src/settings";
import type { EventEmitter } from "src/utils/EventEmitter";
import type { IManager } from "./IManager";

const logger = log.getLogger("HotSandboxManager");

type MinimalDBAPI = {
	getAllNotes: () => Promise<HotSandboxNoteData[]>;
};

export class CacheManager implements IManager {
	private sandboxNotes = new Map<string, HotSandboxNoteData>();

	constructor(
		emitter: EventEmitter<AppEvents>,
		private context: MinimalDBAPI
	) {}

	async load(): Promise<void> {
		const allNotes = await this.context.getAllNotes();
		this.sandboxNotes.clear();

		allNotes.forEach((note) => {
			this.sandboxNotes.set(note.id, note);
		});

		logger.debug(
			`Loaded ${allNotes.length} hot sandbox notes into memory.`
		);
		// this.emitter.emit("notes-loaded", { count: allNotes.length });
	}

	getAllNotes(): HotSandboxNoteData[] {
		return Array.from(this.sandboxNotes.values());
	}

	getNoteContent(masterNoteId: string): string {
		return this.sandboxNotes.get(masterNoteId)?.content ?? "";
	}

	getNoteData(masterNoteId: string): HotSandboxNoteData | undefined {
		return this.sandboxNotes.get(masterNoteId);
	}

	registerNewNote(masterNoteId: string): void {
		if (!this.sandboxNotes.has(masterNoteId)) {
			const newNote: HotSandboxNoteData = {
				id: masterNoteId,
				content: "",
				mtime: Date.now(),
			};
			this.sandboxNotes.set(masterNoteId, newNote);
			logger.debug(`Registered new note: ${masterNoteId}`);
			// this.emitter.emit("sandbox-note-registered", { noteId: masterNoteId });
		}
	}

	deleteNoteData(masterNoteId: string): void {
		this.sandboxNotes.delete(masterNoteId);
		logger.debug(`Deleted note: ${masterNoteId}`);
	}

	updateNoteContent(masterNoteId: string, content: string): void {
		const note = this.sandboxNotes.get(masterNoteId);
		if (note) {
			note.content = content;
			note.mtime = Date.now();
			// this.emitter.emit("sandbox-note-content-updated", {
			// 	noteId: masterNoteId,
			// 	content,
			// });
		}
	}

	unload(): void {
		this.sandboxNotes.clear();
	}
}
