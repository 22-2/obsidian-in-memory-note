import type { PluginSettings } from "src/settings";
import type SandboxNotePlugin from "src/main";
import type { EventEmitter } from "src/utils/EventEmitter";
import type { AppEvents } from "src/events/AppEvents";
import { DEFAULT_PLUGIN_DATA } from "src/utils/constants";
import type { Manager } from "./Manager";
import { type SandboxNotePluginData } from "src/settings";

export class SettingsManager implements Manager {
	private settings!: PluginSettings;
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
		return this.settings;
	}

	async load() {
		const loadedData = await this.context.loadData();
		this.settings = Object.assign(
			{},
			DEFAULT_PLUGIN_DATA,
			loadedData.settings
		);
	}

	unload(): void {}

	async updateSettings(settings: PluginSettings): Promise<void> {
		this.settings = settings;
		this.emitter.emit("settings-update-requested", { settings });
		this.emitter.emit("settings-changed", { newSettings: settings });
	}
}
