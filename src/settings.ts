import { PluginSettingTab, Setting } from "obsidian";
import type InMemoryNotePlugin from "./main";
import { type LogLevel, LOG_LEVEL } from "./utils/logging";

/**
 * Defines the settings for the In-Memory Note plugin.
 */
export interface InMemoryNotePluginSettings {
	logLevel: LogLevel;
	enableSaveNoteContent: boolean;
}
/**
 * Settings tab for the In-Memory Note plugin.
 * Provides UI controls for configuring plugin behavior.
 */
export class InMemoryNoteSettingTab extends PluginSettingTab {
	constructor(public plugin: InMemoryNotePlugin) {
		super(plugin.app, plugin);
	}

	/**
	 * Renders the settings interface with all available options.
	 */
	display(): void {
		this.containerEl.empty();
		
		this.addDebugLoggingSetting();
		this.addAutoSaveSetting();
	}

	/**
	 * Adds the debug logging toggle setting.
	 */
	private addDebugLoggingSetting() {
		new Setting(this.containerEl)
			.setName("Show debug messages")
			.setDesc("Enable or disable debug messages in the console.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.logLevel === LOG_LEVEL.DEBUG)
					.onChange(async (enabled) => {
						this.plugin.settings.logLevel = enabled
							? LOG_LEVEL.DEBUG
							: LOG_LEVEL.INFO;
						await this.plugin.saveSettings();
						this.plugin.initializeLogger();
					});
			});
	}

	/**
	 * Adds the auto-save content setting.
	 */
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
