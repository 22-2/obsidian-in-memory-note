import log from "loglevel";
import type { AppEvents } from "src/events/AppEvents";
import type { HotSandboxNoteData } from "src/settings";
import type { EventEmitter } from "src/utils/EventEmitter";
import type { DatabaseManager } from "./DatabaseManager";
import type { IManager } from "./IManager";

const logger = log.getLogger("HotSandboxManager");

type Context = {
	// getAllSandboxes: DatabaseManager["getAllSandboxes"];
	emitter: EventEmitter<AppEvents>;
	getDbManager: () => {
		getAllSandboxes: DatabaseManager["getAllSandboxes"];
	};
};

export class CacheManager implements IManager {
	private sandboxNotes = new Map<string, HotSandboxNoteData>();

	constructor(private context: Context) {}

	async load(): Promise<void> {
		const allSandboxes = await this.context
			.getDbManager()
			.getAllSandboxes();
		allSandboxes.forEach((note) => {
			this.sandboxNotes.set(note.id, note);
		});

		logger.debug(
			`Loaded ${allSandboxes.length} hot sandbox notes into memory.`
		);
		// this.emitter.emit("notes-loaded", { count: allNotes.length });
	}

	getAllSandboxes(): HotSandboxNoteData[] {
		return Array.from(this.sandboxNotes.values());
	}

	getNoteContent(masterId: string): string {
		return this.sandboxNotes.get(masterId)?.content ?? "";
	}

	get(masterId: string): HotSandboxNoteData | undefined {
		return this.sandboxNotes.get(masterId);
	}

	registerNewNote(masterId: string): void {
		if (!this.sandboxNotes.has(masterId)) {
			const newNote: HotSandboxNoteData = {
				id: masterId,
				content: "",
				mtime: Date.now(),
			};
			this.sandboxNotes.set(masterId, newNote);
			logger.debug(`Registered new note: ${masterId}`);
			// this.emitter.emit("sandbox-note-registered", { noteId: masterId });
		}
	}

	delete(masterId: string): void {
		this.sandboxNotes.delete(masterId);
		logger.debug(`Deleted note: ${masterId}`);
	}

	updateNoteContent(masterId: string, content: string): void {
		const note = this.sandboxNotes.get(masterId);
		if (note) {
			note.content = content;
			note.mtime = Date.now();
			// this.emitter.emit("sandbox-note-content-updated", {
			// 	noteId: masterId,
			// 	content,
			// });
		}
	}

	unload(): void {
		this.sandboxNotes.clear();
	}
}
