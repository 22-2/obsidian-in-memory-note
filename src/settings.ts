import { App, PluginSettingTab, Setting } from "obsidian";
import type SandboxNotePlugin from "./main";
import { FolderSuggest } from "./helpers/interaction";

// --- Plugin Data & Settings Interfaces ---

export interface HotSandboxNoteData {
	id: string;
	content: string;
	mtime: number;
}

export interface SandboxNotePluginData {
	settings: PluginSettings;
	data: {
		hotSandboxNotes: Record<string, HotSandboxNoteData>;
	};
}

export interface PluginSettings {
	enableLogger: boolean;
	enableAutoSave: boolean;
	autoSaveDebounceMs: number;
	defaultSavePath: string;
	confirmBeforeSaving: boolean;
}

export class SandboxNoteSettingTab extends PluginSettingTab {
	constructor(public plugin: SandboxNotePlugin) {
		super(plugin.app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.addDebugLoggingSetting();
		this.addFileConversionSection();
	}

	private addDebugLoggingSetting(): void {
		const settings = this.plugin.orchestrator.getSettings();

		new Setting(this.containerEl)
			.setName("Show debug messages")
			.setDesc("Enable or disable debug messages in the console.")
			.addToggle((toggle) => {
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

	private addFileConversionSection(): void {
		new Setting(this.containerEl).setHeading().setName("File Conversion");

		this.addDefaultSavePathSetting();
		this.addConfirmBeforeSavingSetting();
	}

	private addDefaultSavePathSetting(): void {
		const settings = this.plugin.orchestrator.getSettings();

		new Setting(this.containerEl)
			.setName("Default Save Location")
			.setDesc(
				"The default folder path where converted notes will be saved. Must end with a slash (/) for a folder."
			)
			.addSearch((search) => {
				search
					.setValue(settings.defaultSavePath)
					.setPlaceholder("e.g. Sandbox Notes/")
					.onChange(async (value) => {
						const normalizedValue =
							value && !value.endsWith("/") ? `${value}/` : value;

						await this.plugin.orchestrator.updateSettings({
							...settings,
							defaultSavePath: normalizedValue,
						});
					});

				new FolderSuggest(this.app, search.inputEl);
			});
	}

	private addConfirmBeforeSavingSetting(): void {
		const settings = this.plugin.orchestrator.getSettings();

		new Setting(this.containerEl)
			.setName("Confirm Save Location Before Converting")
			.setDesc(
				"If enabled, a modal will appear to choose the file path every time you convert a sandbox note."
			)
			.addToggle((toggle) => {
				toggle
					.setValue(settings.confirmBeforeSaving)
					.onChange(async (value) => {
						await this.plugin.orchestrator.updateSettings({
							...settings,
							confirmBeforeSaving: value,
						});
					});
			});
	}
}
