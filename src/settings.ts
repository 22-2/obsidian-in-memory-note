import { PluginSettingTab, Setting } from "obsidian";
import type InMemoryNotePlugin from "./main";
import { type LogLevel, LOG_LEVEL } from "./utils/logging";

/**
 * Defines the settings for the In-Memory Note plugin.
 */
export interface InMemoryNotePluginSettings {
	logLevel: LogLevel;
}
/**
 * Creates the setting tab for the plugin.
 */
export class InMemoryNoteSettingTab extends PluginSettingTab {
	constructor(public plugin: InMemoryNotePlugin) {
		super(plugin.app, plugin);
	}

	/**
	 * Renders the settings UI.
	 */
	display(): void {
		this.containerEl.empty();

		new Setting(this.containerEl)
			.setName("Show debug messages")
			.setDesc("Enable or disable debug messages in the console.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.logLevel === LOG_LEVEL.DEBUG)
					.onChange(async (val) => {
						this.plugin.settings.logLevel = val
							? LOG_LEVEL.DEBUG
							: LOG_LEVEL.INFO;
						await this.plugin.saveSettings();
						this.plugin.initializeLogger();
					});
			});
	}
}
