import type SandboxNotePlugin from "../main";
import { IN_MEMORY_NOTE_ICON, SANDBOX_NOTE_ICON } from "../utils/constants";
import { AbstractNoteView } from "../AbstractNoteView";

/** Manages UI elements like ribbon icons and commands */
export class UIManager {
	private plugin: SandboxNotePlugin;

	constructor(plugin: SandboxNotePlugin) {
		this.plugin = plugin;
	}

	/** Setup UI elements (ribbon icon and commands) */
	setupUserInterface() {
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

		// Command to save the current note (if it's saveable)
		this.plugin.addCommand({
			id: "save-note",
			name: "Save current note",
			checkCallback: (checking) => {
				const view =
					this.plugin.app.workspace.getActiveViewOfType(
						AbstractNoteView
					);
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
}
