import { PluginSettingTab, Setting } from "obsidian";
import type SandboxNotePlugin from "./main";
import { type LogLevel } from "./utils/logging";

/** Plugin settings interface. */
export interface SandboxNotePluginSettings {
	logLevel: LogLevel;
	enableSaveNoteContent: boolean;
	enableUnsafeCtrlS: boolean;
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
		this.addUnsafeCtrlSSetting();
	}

	/** Add debug logging toggle. */
	private addDebugLoggingSetting() {
		new Setting(this.containerEl)
			.setName("Show debug messages")
			.setDesc("Enable or disable debug messages in the console.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.logLevel === "debug")
					.onChange(async (enabled) => {
						this.plugin.settings.logLevel = enabled
							? "debug"
							: "info";
						await this.plugin.saveSettings();
						this.plugin.initializeLogger();
					});
			});
	}

	/** Add auto-save content setting. */
	private addAutoSaveSetting() {
		new Setting(this.containerEl)
			.setName("Auto-save note content")
			.setDesc(
				"Automatically save note content to a file when switching away from the view. " +
					"This does not affect the Ctrl+S behavior."
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.enableSaveNoteContent)
					.onChange(async (enabled) => {
						this.plugin.settings.enableSaveNoteContent = enabled;
						await this.plugin.saveSettings();
					});
			});
	}

	/** Add unsafe Ctrl+S save setting. */
	private addUnsafeCtrlSSetting() {
		new Setting(this.containerEl)
			.setName("Enable Ctrl+S to save sandbox note")
			.setDesc(
				"Overrides the default save command (Ctrl+S) to save the content of the sandbox note. " +
					"This is an unsafe feature as it alters core Obsidian behavior."
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.enableUnsafeCtrlS)
					.onChange(async (enabled) => {
						this.plugin.settings.enableUnsafeCtrlS = enabled;
						await this.plugin.saveSettings();
						this.plugin.commandManager.updateSaveCommandMonkeyPatch();
					});
			});
	}
}
