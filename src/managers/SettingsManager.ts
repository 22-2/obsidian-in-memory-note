import type { PluginSettings } from "src/settings";
import type SandboxNotePlugin from "src/main";
import type { EventEmitter } from "src/utils/EventEmitter";
import type { AppEvents } from "src/events/AppEvents";

export class SettingsManager {
	private plugin: SandboxNotePlugin;
	private emitter: EventEmitter<AppEvents>;
	private settings: PluginSettings;

	constructor(
		plugin: SandboxNotePlugin,
		emitter: EventEmitter<AppEvents>,
		initialSettings: PluginSettings
	) {
		this.plugin = plugin;
		this.emitter = emitter;
		this.settings = initialSettings;
	}

	getSettings(): PluginSettings {
		return this.settings;
	}

	async updateSettings(settings: PluginSettings): Promise<void> {
		this.settings = settings;
		// StateManagerに設定保存を委譲
		this.emitter.emit("settings-update-requested", { settings });
		this.emitter.emit("settings-changed", { newSettings: settings });
	}
}
