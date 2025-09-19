import type InMemoryNotePlugin from "../main";
import { IN_MEMORY_NOTE_ICON } from "../utils/constants";

/** Manages UI elements like ribbon icons and commands */
export class UIManager {
	private plugin: InMemoryNotePlugin;

	constructor(plugin: InMemoryNotePlugin) {
		this.plugin = plugin;
	}

	/** Setup UI elements (ribbon icon and commands) */
	setupUserInterface() {
		this.plugin.addRibbonIcon(IN_MEMORY_NOTE_ICON, "Open in-memory note", () => {
			this.plugin.activateView();
		});

		this.plugin.addCommand({
			id: "open-in-memory-note-view",
			name: "Open in-memory note",
			callback: () => {
				this.plugin.activateView();
			},
		});
	}
}