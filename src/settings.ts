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
		// this.addAutoSaveSetting();
		this.addAutoSaveDebounceSetting();
		// this.addCtrlSSetting();
	}

	/** Add debug logging toggle. */
	private addDebugLoggingSetting() {
		new Setting(this.containerEl)
			.setName("Show debug messages")
			.setDesc("Enable or disable debug messages in the console.")
			.addToggle((toggle) => {
				const settings = this.plugin.orchestrator.getSettings();
				toggle
					.setValue(settings.enableLogger)
					.onChange(async (enabled) => {
						await this.plugin.orchestrator.updateSettings({
							...settings,
							enableLogger: enabled,
						});
					});
			});
	}

	/** Add auto-save debounce delay setting. */
	private addAutoSaveDebounceSetting() {
		const settings = this.plugin.orchestrator.getSettings();
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
						await this.plugin.orchestrator.updateSettings({
							...settings,
							autoSaveDebounceMs: Number.parseInt(value, 10),
						});
					});
			});
	}
}
