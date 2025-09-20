import type SandboxNotePlugin from "../main";
import { SandboxNoteView } from "../views/SandboxNoteView";
import { around } from "monkey-around";

/** Manages command overrides and monkey patches */
export class CommandManager {
	private plugin: SandboxNotePlugin;
	private unpatchSaveCommand: (() => void) | null = null;

	constructor(plugin: SandboxNotePlugin) {
		this.plugin = plugin;
	}

	/** Setup monkey patch for save command to handle sandbox notes */
	updateSaveCommandMonkeyPatch() {
		const saveCommandDefinition =
			this.plugin.app.commands?.commands?.["editor:save-file"];

		if (!saveCommandDefinition?.checkCallback) {
			return;
		}

		// If the setting is enabled and there is no patch, patch it.
		if (
			this.plugin.settings.enableUnsafeCtrlS &&
			!this.unpatchSaveCommand
		) {
			this.unpatchSaveCommand = around(saveCommandDefinition, {
				checkCallback: (orig) => {
					// Return a new checkCallback function that acts as our interceptor
					return (checking: boolean) => {
						try {
							const activeView =
								this.plugin.app.workspace.getActiveViewOfType(
									SandboxNoteView
								);

							if (activeView) {
								if (checking) {
									return true;
								}
								this.plugin.saveManager.saveNoteContentToFile(
									activeView
								);
								return true; // Indicate that the command was handled.
							}

							// Otherwise, call the original save command's logic.
							return orig?.call(this, checking);
						} catch (error) {
							console.error(
								"Sandbox-note: monkey patch for save command failed.",
								error
							);
							// Fallback to original command if our patch fails
							return orig?.call(this, checking);
						}
					};
				},
			});
			this.plugin.register(this.unpatchSaveCommand);
		}
		// If the setting is disabled and there is a patch, unpatch it.
		else if (
			!this.plugin.settings.enableUnsafeCtrlS &&
			this.unpatchSaveCommand
		) {
			this.unpatchSaveCommand();
			this.unpatchSaveCommand = null;
		}
	}
}
