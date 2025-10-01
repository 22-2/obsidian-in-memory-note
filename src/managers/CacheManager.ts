import log from "loglevel";
import type { AppEvents } from "src/events/AppEvents";
import type { HotSandboxNoteData } from "src/types";
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
	private sandboxes = new Map<string, HotSandboxNoteData>();

	constructor(private context: Context) {}

	async load(): Promise<void> {
		const allSandboxes = await this.context
			.getDbManager()
			.getAllSandboxes();
		allSandboxes.forEach((note) => {
			this.sandboxes.set(note.id, note);
		});

		logger.debug(
			`Loaded ${allSandboxes.length} hot sandbox notes into memory.`
		);
		// this.emitter.emit("notes-loaded", { count: allNotes.length });
	}

	getAllSandboxes(): HotSandboxNoteData[] {
		return Array.from(this.sandboxes.values());
	}

	getSandboxContent(masterId: string): string {
		return this.sandboxes.get(masterId)?.content ?? "";
	}

	get(masterId: string): HotSandboxNoteData | undefined {
		return this.sandboxes.get(masterId);
	}

	registerNewSandbox(masterId: string): void {
		if (!this.sandboxes.has(masterId)) {
			const newNote: HotSandboxNoteData = {
				id: masterId,
				content: "",
				mtime: Date.now(),
			};
			this.sandboxes.set(masterId, newNote);
			logger.debug(`Registered new note: ${masterId}`);
			// this.emitter.emit("sandbox-note-registered", { noteId: masterId });
		}
	}

	delete(masterId: string): void {
		this.sandboxes.delete(masterId);
		logger.debug(`Deleted note: ${masterId}`);
	}

	updateSandboxContent(masterId: string, content: string): void {
		const note = this.sandboxes.get(masterId);
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
		this.sandboxes.clear();
	}
}
