import { PluginSettingTab, Setting } from "obsidian";
import type SandboxNotePlugin from "./main";

export interface HotSandboxNoteData {
	id: string;
	content: string;
	mtime: number;
	// deleted: boolean;
}

export interface SandboxNotePluginData {
	settings: PluginSettings;
	data: {
		hotSandboxNotes: Record<string, HotSandboxNoteData>;
	};
}

/** Plugin settings interface. */
export interface PluginSettings {
	enableLogger: boolean;
	enableAutoSave: boolean;
	autoSaveDebounceMs: number;
	enableCtrlS: boolean;
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
		this.addCtrlSSetting();
	}

	/** Add debug logging toggle. */
	private addDebugLoggingSetting() {
		new Setting(this.containerEl)
			.setName("Show debug messages")
			.setDesc("Enable or disable debug messages in the console.")
			.addToggle((toggle) => {
				const settings = this.plugin.stateManager.getSettings();
				toggle
					.setValue(settings.enableLogger)
					.onChange(async (enabled) => {
						await this.plugin.stateManager.updateSettings({
							...settings,
							enableLogger: enabled,
						});
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
				const settings = this.plugin.stateManager.getSettings();
				toggle
					.setValue(settings.enableAutoSave)
					.onChange(async (enabled) => {
						await this.plugin.stateManager.updateSettings({
							...settings,
							enableAutoSave: enabled,
						});
						// Re-render the dependent setting
						this.display();
					});
			});
	}

	/** Add auto-save debounce delay setting. */
	private addAutoSaveDebounceSetting() {
		const settings = this.plugin.stateManager.getSettings();
		if (!settings.enableAutoSave) {
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
					.setValue(String(settings.autoSaveDebounceMs))
					.onChange(async (value) => {
						await this.plugin.stateManager.updateSettings({
							...settings,
							autoSaveDebounceMs: Number.parseInt(value, 10),
						});
					});
			});
	}

	/** Add Ctrl+S save setting. */
	private addCtrlSSetting() {
		new Setting(this.containerEl)
			.setName("Enable Ctrl+S to save sandbox note")
			.setDesc(
				"Overrides the default save command (Ctrl+S) to save the content of the sandbox note. "
			)
			.addToggle((toggle) => {
				const settings = this.plugin.stateManager.getSettings();
				toggle
					.setValue(settings.enableCtrlS)
					.onChange(async (enabled) => {
						await this.plugin.stateManager.updateSettings({
							...settings,
							enableCtrlS: enabled,
						});
					});
			});
	}
}
