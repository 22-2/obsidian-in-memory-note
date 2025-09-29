import Dexie, { type Table } from "dexie";
import type { HotSandboxNoteData } from "src/settings";

export class DatabaseAPI extends Dexie {
	// 'notes' is typed with schema of our note object.
	sandboxes!: Table<HotSandboxNoteData>;

	constructor() {
		super("SandboxNoteDatabase");
		this.version(1).stores({
			sandboxes: "&id, content, mtime", // Primary key and indexed props
		});
	}

	async getSandbox(id: string): Promise<HotSandboxNoteData | undefined> {
		return this.sandboxes.get(id);
	}

	async saveSandbox(note: HotSandboxNoteData): Promise<string> {
		await this.sandboxes.put(note);
		return note.id;
	}

	async deleteSandbox(id: string): Promise<void> {
		await this.sandboxes.delete(id);
	}

	async getAllSandboxes(): Promise<HotSandboxNoteData[]> {
		return this.sandboxes.toArray();
	}

	async clearAllSandboxes(): Promise<void> {
		await this.sandboxes.clear();
	}
	countSandboxes(): Promise<number> {
		return this.sandboxes.count();
	}
}
