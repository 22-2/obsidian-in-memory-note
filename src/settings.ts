import { PluginSettingTab, Setting } from "obsidian";
import type SandboxNotePlugin from "./main";

export interface PluginData {
	settings: SandboxNotePluginSettings;
	data: {
		noteContent: string;
		lastSaved: string;
	};
}

/** Plugin settings interface. */
export interface SandboxNotePluginSettings {
	enableLogger: boolean;
	enableAutoSave: boolean;
	autoSaveDebounceMs: number;
	// enableUnsafeCtrlS: boolean;
	enableCtrlS: boolean;
	noteContent: string;
	lastSaved: string;
}
/** Settings tab for the plugin. */
export class SandboxNoteSettingTab extends PluginSettingTab {
	constructor(public plugin: SandboxNotePlugin) {
		super(plugin.app, plugin);
	}

	/** Render settings interface. */
	display(): void {
		this.containerEl.empty();

		this.addDebugLoggingSetting();
		this.addAutoSaveSetting();
		this.addAutoSaveDebounceSetting();
		// this.addUnsafeCtrlSSetting();
	}

	/** Add debug logging toggle. */
	private addDebugLoggingSetting() {
		new Setting(this.containerEl)
			.setName("Show debug messages")
			.setDesc("Enable or disable debug messages in the console.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.enableLogger)
					.onChange(async (enabled) => {
						this.plugin.settings.enableLogger = enabled;
						this.plugin.initializeLogger();
						await this.plugin.saveSettings();
					});
			});
	}

	/** Add auto-save content setting. */
	private addAutoSaveSetting() {
		new Setting(this.containerEl)
			.setName("Auto-save note content")
			.setDesc(
				"When enabled, the note content is saved automatically after you stop typing. " +
					"This feature helps prevent data loss from unexpected shutdowns."
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.enableAutoSave)
					.onChange(async (enabled) => {
						this.plugin.settings.enableAutoSave = enabled;
						await this.plugin.saveSettings();
						// Re-render the dependent setting
						this.display();
					});
			});
	}

	/** Add auto-save debounce delay setting. */
	private addAutoSaveDebounceSetting() {
		if (!this.plugin.settings.enableAutoSave) {
			return;
		}

		const options: Record<string, string> = {
			"3000": "3 seconds",
			"5000": "5 seconds",
			"10000": "10 seconds",
			"30000": "30 seconds",
			"60000": "1 minute",
			"300000": "5 minutes",
		};

		new Setting(this.containerEl)
			.setName("Auto-save delay")
			.setDesc(
				"The delay after you stop typing before the note is saved."
			)
			.addDropdown((dropdown) => {
				dropdown
					.addOptions(options)
					.setValue(String(this.plugin.settings.autoSaveDebounceMs))
					.onChange(async (value) => {
						this.plugin.settings.autoSaveDebounceMs =
							Number.parseInt(value, 10);
						await this.plugin.saveSettings();
					});
			});
	}

	/** Add unsafe Ctrl+S save setting. */
	// private addUnsafeCtrlSSetting() {
	// 	new Setting(this.containerEl)
	// 		.setName("Enable Ctrl+S to save sandbox note")
	// 		.setDesc(
	// 			"Overrides the default save command (Ctrl+S) to save the content of the sandbox note. " +
	// 				"This is an unsafe feature as it alters core Obsidian behavior."
	// 		)
	// 		.addToggle((toggle) => {
	// 			toggle
	// 				.setValue(this.plugin.settings.enableUnsafeCtrlS)
	// 				.onChange(async (enabled) => {
	// 					this.plugin.settings.enableUnsafeCtrlS = enabled;
	// 					await this.plugin.saveSettings();
	// 					// this.plugin.commandManager.updateSaveCommandMonkeyPatch();
	// 				});
	// 		});
	// }
	/** Add Ctrl+S save setting. */
	// private addCtrlSSetting() {
	// 	new Setting(this.containerEl)
	// 		.setName("Enable Ctrl+S to save sandbox note")
	// 		.setDesc(
	// 			"Overrides the default save command (Ctrl+S) to save the content of the sandbox note. "
	// 		)
	// 		.addToggle((toggle) => {
	// 			toggle
	// 				.setValue(this.plugin.settings.enableCtrlS)
	// 				.onChange(async (enabled) => {
	// 					this.plugin.settings.enableCtrlS = enabled;
	// 					await this.plugin.saveSettings();
	// 					// this.plugin.commandManager.updateSaveCommandMonkeyPatch();
	// 				});
	// 		});
	// }
}
