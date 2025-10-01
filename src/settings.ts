import { PluginSettingTab, Setting } from "obsidian";
import { FolderSuggest } from "./helpers/interaction";
import type SandboxNotePlugin from "./main";
import { DEBUG_MODE } from "./utils/constants";

export interface SandboxNotePluginData {
	settings: PluginSettings;
}

export interface PluginSettings {
	enableLogger: boolean;
	enableAutoSave: boolean;
	autoSaveDebounceMs: number;
	defaultSavePath: string;
	confirmBeforeSaving: boolean;
	firstLineAsTitle: boolean;
	saveToVaultOnCommandExecuted: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	enableLogger: DEBUG_MODE,
	enableAutoSave: true,
	autoSaveDebounceMs: 3000,
	defaultSavePath: "./",
	confirmBeforeSaving: true,
	firstLineAsTitle: false,
	saveToVaultOnCommandExecuted: false,
};

export const DEFAULT_PLUGIN_DATA: SandboxNotePluginData = {
	settings: DEFAULT_SETTINGS,
};

export class SandboxNoteSettingTab extends PluginSettingTab {
	constructor(public plugin: SandboxNotePlugin) {
		super(plugin.app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.addAppearanceSection();
		this.addFileConversionSection();
		this.addDebugLoggingSetting();
	}

	private addDebugLoggingSetting(): void {
		const settings = this.plugin.orchestrator.getSettings();
		new Setting(this.containerEl).setHeading().setName("Advanced");

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

	private addAppearanceSection(): void {
		new Setting(this.containerEl).setHeading().setName("Appearance");

		this.addFirstLineAsTitleSetting();
	}

	private addFileConversionSection(): void {
		new Setting(this.containerEl).setHeading().setName("File Operation");

		this.addDefaultSavePathSetting();
		this.addConfirmBeforeSavingSetting();
		this.addSaveToVaultSetting();
	}

	private addDefaultSavePathSetting(): void {
		const settings = this.plugin.orchestrator.getSettings();

		new Setting(this.containerEl)
			.setName("Default save location")
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
			.setName("Confirm save location before converting")
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

	private addFirstLineAsTitleSetting(): void {
		const settings = this.plugin.orchestrator.getSettings();

		new Setting(this.containerEl)
			.setName("First line as title")
			.setDesc("Use the first line of the note as the title.")
			.addToggle((toggle) => {
				toggle
					.setValue(settings.firstLineAsTitle)
					.onChange(async (value) => {
						await this.plugin.orchestrator.updateSettings({
							...settings,
							firstLineAsTitle: value,
						});
					});
			});
	}

	private addSaveToVaultSetting(): void {
		const settings = this.plugin.orchestrator.getSettings();

		new Setting(this.containerEl)
			.setName("Save to vault on command")
			.setDesc(
				"If enabled, the note will be saved to the vault when you execute the save command (Ctrl+S or Cmd+S)."
			)
			.addToggle((toggle) => {
				toggle
					.setValue(settings.saveToVaultOnCommandExecuted)
					.onChange(async (value) => {
						await this.plugin.orchestrator.updateSettings({
							...settings,
							saveToVaultOnCommandExecuted: value,
						});
					});
			});
	}
}
