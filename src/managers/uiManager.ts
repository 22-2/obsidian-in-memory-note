import type SandboxNotePlugin from "../main";
import { SANDBOX_NOTE_ICON } from "../utils/constants";

/** Manages UI elements like ribbon icons and commands */
export class UIManager {
	private plugin: SandboxNotePlugin;

	constructor(plugin: SandboxNotePlugin) {
		this.plugin = plugin;
	}

	/** Setup UI elements (ribbon icon and commands) */
	setupUserInterface() {
		this.plugin.addRibbonIcon(
			SANDBOX_NOTE_ICON,
			"Open sandbox note",
			() => {
				this.plugin.activateView();
			}
		);

		this.plugin.addCommand({
			id: "open-sandbox-note-view",
			name: "Open sandbox note",
			callback: () => {
				this.plugin.activateView();
			},
		});
	}
}
