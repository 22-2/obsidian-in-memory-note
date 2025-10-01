import type { Plugin } from "obsidian";
import type { AppEvents } from "src/events/AppEvents";
import type { PluginSettings } from "src/settings";
import { DEFAULT_PLUGIN_DATA, type SandboxNotePluginData } from "src/settings";
import type { EventEmitter } from "src/utils/EventEmitter";
import type { IManager } from "./IManager";

type Context = {
	emitter: EventEmitter<AppEvents>;
	loadData: Plugin["loadData"];
	saveData: Plugin["saveData"];
};

export class SettingsManager implements IManager {
	private data: SandboxNotePluginData = DEFAULT_PLUGIN_DATA;
	constructor(private context: Context) {}

	getSettings(): PluginSettings {
		return this.data.settings;
	}

	async load() {
		const loadedData = await this.context.loadData();
		this.data = {
			...this.data,
			...loadedData,
		};
	}

	unload(): void {}

	async updateSettingsAndSave(settings: PluginSettings): Promise<void> {
		this.data.settings = settings;
		await this.context.saveData({
			...this.data,
			settings: this.data.settings,
		});
		this.context.emitter.emit("settings-changed", {
			newSettings: this.data.settings,
		});
	}
}
