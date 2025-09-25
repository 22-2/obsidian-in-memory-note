import Dexie, { type Table } from "dexie";
import type { HotSandboxNoteData } from "src/settings";

export class DatabaseManager extends Dexie {
	// 'notes' is typed with schema of our note object.
	notes!: Table<HotSandboxNoteData>;

	constructor() {
		super("SandboxNoteDatabase");
		this.version(1).stores({
			notes: "&id, content, mtime", // Primary key and indexed props
		});
	}

	async getNote(id: string): Promise<HotSandboxNoteData | undefined> {
		return this.notes.get(id);
	}

	async saveNote(note: HotSandboxNoteData): Promise<string> {
		await this.notes.put(note);
		return note.id;
	}

	async deleteNote(id: string): Promise<void> {
		await this.notes.delete(id);
	}

	async getAllNotes(): Promise<HotSandboxNoteData[]> {
		return this.notes.toArray();
	}
}
