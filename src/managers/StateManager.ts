import log from "loglevel";
import type { AppEvents } from "src/events/AppEvents";
import type SandboxNotePlugin from "src/main";
import type {
	HotSandboxNoteData,
	PluginSettings,
	SandboxNotePluginData,
} from "src/settings";
import { DEFAULT_PLUGIN_DATA } from "src/utils/constants";
import type { EventEmitter } from "src/utils/EventEmitter";
import type { DatabaseAPI } from "./DatabaseAPI";
import type { Manager } from "./Manager";
import { SettingsManager } from "./SettingsManager";
import { HotSandboxManager } from "./HotSandboxManager";
import { AppEventManager } from "./AppEventManager";

const logger = log.getLogger("StateManager");

/**
 * 軽量化されたStateManager - 各マネージャーの調整役として機能
 */
export class StateManager implements Manager {
	private plugin: SandboxNotePlugin;
	private emitter: EventEmitter<AppEvents>;
	private data: SandboxNotePluginData = DEFAULT_PLUGIN_DATA;

	// 各マネージャー
	private settingsManager: SettingsManager;
	private hotSandboxManager: HotSandboxManager;
	private eventManager: AppEventManager;

	constructor(
		plugin: SandboxNotePlugin,
		emitter: EventEmitter<AppEvents>,
		databaseAPI: DatabaseAPI
	) {
		this.plugin = plugin;
		this.emitter = emitter;

		// マネージャーの初期化
		this.settingsManager = new SettingsManager(
			plugin,
			emitter,
			DEFAULT_PLUGIN_DATA.settings
		);

		this.hotSandboxManager = new HotSandboxManager(emitter, databaseAPI);

		this.eventManager = new AppEventManager(
			emitter,
			this.hotSandboxManager,
			this.settingsManager
		);

		// 設定更新リクエストのハンドリング
		this.emitter.on(
			"settings-update-requested",
			this.handleSettingsUpdateRequest
		);
	}

	async load(): Promise<void> {
		// Obsidianからデータ読み込み
		const loadedData = await this.plugin.loadData();
		this.data = Object.assign({}, DEFAULT_PLUGIN_DATA, loadedData);

		// 各マネージャーの初期化
		this.settingsManager = new SettingsManager(
			this.plugin,
			this.emitter,
			this.data.settings
		);

		await this.hotSandboxManager.initialize();

		// イベントハンドラーの登録
		this.eventManager.registerEventListeners();

		logger.debug("StateManager and all sub-managers loaded successfully.");
	}

	unload(): void {
		this.eventManager.unregisterEventListeners();
		this.hotSandboxManager.cleanup();
		this.emitter.off(
			"settings-update-requested",
			this.handleSettingsUpdateRequest
		);

		logger.debug(
			"StateManager and all sub-managers unloaded successfully."
		);
	}

	// --- Delegated Methods ---

	getSettings(): PluginSettings {
		return this.settingsManager.getSettings();
	}

	async updateSettings(settings: PluginSettings): Promise<void> {
		await this.settingsManager.updateSettings(settings);
	}

	getAllNotes(): HotSandboxNoteData[] {
		return this.hotSandboxManager.getAllNotes();
	}

	getNoteContent(masterNoteId: string): string {
		return this.hotSandboxManager.getNoteContent(masterNoteId);
	}

	registerNewNote(masterNoteId: string): void {
		this.hotSandboxManager.registerNewNote(masterNoteId);
	}

	getNoteData(masterNoteId: string): HotSandboxNoteData | undefined {
		return this.hotSandboxManager.getNoteData(masterNoteId);
	}

	// --- Private Event Handlers ---

	private handleSettingsUpdateRequest = async (
		payload: AppEvents["settings-update-requested"]
	) => {
		this.data.settings = payload.settings;
		await this.plugin.saveData(this.data);
		logger.debug("Settings saved to Obsidian storage.");
	};
}
