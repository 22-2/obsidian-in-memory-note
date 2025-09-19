import type SandboxNotePlugin from "../main";
import { SandboxNoteView } from "../view";
import { around } from "monkey-around";

/** Manages command overrides and monkey patches */
export class CommandManager {
	private plugin: SandboxNotePlugin;

	constructor(plugin: SandboxNotePlugin) {
		this.plugin = plugin;
	}

	/** Setup monkey patch for save command to handle sandbox notes */
	setupSaveCommandMonkeyPatch() {
		const saveCommandDefinition =
			this.plugin.app.commands?.commands?.["editor:save-file"];

		if (saveCommandDefinition?.checkCallback) {
			// Apply the monkey-patch using 'around'
			this.plugin.register(
				around(saveCommandDefinition, {
					checkCallback: (orig) => {
						// Return a new checkCallback function that acts as our interceptor
						return (checking: boolean) => {
							try {
								if (checking) {
									// If Obsidian is just checking if the command is available,
									// we should always allow it, or delegate to the original for more complex checks.
									// For our purpose, we want the save command to always appear if Obsidian normally allows it.
									return orig?.call(this, checking) ?? true;
								}

								// When the command is actually executed (checking is false)
								const activeView =
									this.plugin.app.workspace.getActiveViewOfType(
										SandboxNoteView
									);

								if (
									activeView &&
									this.plugin.settings.enableSaveNoteContent
								) {
									// If it's an SandboxNoteView and saving is enabled,
									// execute our custom save logic.
									this.plugin.saveManager.saveNoteContentToFile(
										activeView
									);
									return true; // Indicate that the command was handled.
								} else {
									// Otherwise, call the original save command's logic.
									// It's important to call 'orig' with 'this' context if it depends on it.
									return orig?.call(this, checking);
								}
							} catch (error) {
								console.error(
									"SandBox-note: monkey patch for save command failed.",
									error
								);
								// Fallback to original command if our patch fails
								return orig?.call(this, checking);
							}
						};
					},
				})
			);
		}
	}
}
