import type SandboxNotePlugin from "../main";
import { HOT_SANDBOX_NOTE_ICON } from "../utils/constants";
import type { Manager } from "./Manager";
import { convertToFileAndClear } from "src/views/internal/utils";

/** Manages UI elements like ribbon icons and commands */
export class InteractionManager implements Manager {
	private plugin: SandboxNotePlugin;

	constructor(plugin: SandboxNotePlugin) {
		this.plugin = plugin;
	}

	/** Setup UI elements (ribbon icon and commands) */
	public load() {
		// Command to open the new hot sandbox note
		this.plugin.addCommand({
			id: "open-hot-sandbox-note-view",
			name: "Open new hot sandbox note",
			icon: HOT_SANDBOX_NOTE_ICON,
			callback: () => {
				this.plugin.activateNewHotSandboxView();
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
						convertToFileAndClear(view);
					}
					return true;
				}
				return false;
			},
		});

		// Ribbon icon to open the hot sandbox note
		this.plugin.addRibbonIcon(
			HOT_SANDBOX_NOTE_ICON,
			"Open new hot sandbox note",
			() => {
				this.plugin.activateNewHotSandboxView();
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
