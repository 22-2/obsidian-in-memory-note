import type { AppEvents } from "src/events/AppEvents";
import type { PluginSettings } from "src/settings";
import { type SandboxNotePluginData } from "src/settings";
import type { EventEmitter } from "src/utils/EventEmitter";
import { DEFAULT_PLUGIN_DATA } from "src/utils/constants";
import type { IManager } from "./IManager";

export class SettingsManager implements IManager {
	private data!: SandboxNotePluginData;
	constructor(
		private emitter: EventEmitter<AppEvents>,
		private context: {
			loadData: () => Promise<SandboxNotePluginData>;
			saveData: (data: SandboxNotePluginData) => Promise<void>;
		}
	) {
		this.emitter = emitter;
	}

	getSettings(): PluginSettings {
		return this.data.settings;
	}

	async load() {
		const loadedData = await this.context.loadData();
		this.data = {
			...DEFAULT_PLUGIN_DATA,
			...loadedData,
		};
	}

	unload(): void {}

	async updateSettingsAndSave(settings: PluginSettings): Promise<void> {
		this.data.settings = settings;
		this.emitter.emit("settings-update-requested", { settings });
		this.emitter.emit("settings-changed", { newSettings: settings });
		this.context.saveData({
			...this.data,
			settings: this.data.settings,
		});
	}
}
