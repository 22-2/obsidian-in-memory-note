import { SandboxNoteView } from "src/view";
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
		this.plugin.addCommand({
			id: "save-sandbox",
			name: "Save current sandbox",
			checkCallback: (checking) => {
				const view =
					this.plugin.app.workspace.getActiveViewOfType(
						SandboxNoteView
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
	}
}
