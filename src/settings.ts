import { PluginSettingTab, Setting } from "obsidian";
import type InMemoryNotePlugin from "./main";
import { type LogLevel } from "./utils/logging";

/** Plugin settings interface. */
export interface InMemoryNotePluginSettings {
	logLevel: LogLevel;
	enableSaveNoteContent: boolean;
}
/** Settings tab for the plugin. */
export class InMemoryNoteSettingTab extends PluginSettingTab {
	constructor(public plugin: InMemoryNotePlugin) {
		super(plugin.app, plugin);
	}

	/** Render settings interface. */
	display(): void {
		this.containerEl.empty();

		this.addDebugLoggingSetting();
		this.addAutoSaveSetting();
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
					"Only one saved note is maintained at a time."
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
}
