import { AbstractNoteView } from "src/views/internal/AbstractNoteView";
import type SandboxNotePlugin from "../main";
import { IN_MEMORY_NOTE_ICON, SANDBOX_NOTE_ICON } from "../utils/constants";
import type { Manager } from "./Manager";

/** Manages UI elements like ribbon icons and commands */
export class InteractionManager implements Manager {
	private plugin: SandboxNotePlugin;

	constructor(plugin: SandboxNotePlugin) {
		this.plugin = plugin;
	}

	/** Setup UI elements (ribbon icon and commands) */
	public load() {
		// Command to open the sandbox note
		this.plugin.addCommand({
			id: "open-sandbox-note-view",
			name: "Open sandbox note",
			icon: SANDBOX_NOTE_ICON,
			callback: () => {
				this.plugin.activateSandboxView();
			},
		});

		// Command to open the in-memory note
		this.plugin.addCommand({
			id: "open-in-memory-note-view",
			name: "Open in-memory note",
			icon: IN_MEMORY_NOTE_ICON,
			callback: () => {
				this.plugin.activateInMemoryView();
			},
		});

		this.plugin.addCommand({
			id: "convert-to-file",
			name: "Convert to file",
			icon: "file-pen-line",
			checkCallback: (checking) => {
				const view = this.plugin.getActiveAbstractNoteView();
				if (view) {
					if (!checking) {
						view.convertToFileAndClear();
					}
					return true;
				}
				return false;
			},
		});

		// Command to save the current note (if it's saveable)
		this.plugin.addCommand({
			id: "save-note",
			name: "Save current note",
			checkCallback: (checking) => {
				const view = this.plugin.getActiveSandboxNoteView();
				if (view) {
					if (!checking) {
						view.save();
					}
					return true;
				}
				return false;
			},
		});

		// Ribbon icon to open the sandbox note
		this.plugin.addRibbonIcon(
			SANDBOX_NOTE_ICON,
			"Open sandbox note",
			() => {
				this.plugin.activateSandboxView();
			}
		);
		// Ribbon icon to open the in-memory note
		this.plugin.addRibbonIcon(
			IN_MEMORY_NOTE_ICON,
			"Open in-memory note",
			() => {
				this.plugin.activateInMemoryView();
			}
		);
	}

	/**
	 * Unload the UI elements.
	 * Obsidian's API automatically cleans up commands and ribbon icons when the plugin is unloaded.
	 */
	public unload() {
		// Nothing to do here
	}
}
