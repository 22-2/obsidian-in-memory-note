import log from "loglevel";
import type { AppEvents } from "src/events/AppEvents";
import type SandboxNotePlugin from "src/main";
import { DatabaseManager } from "src/managers/DatabaseManager";
import type { EventEmitter } from "src/utils/EventEmitter";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";
import { CacheManager } from "./CacheManager";
import { CodeMirrorExtensionManager } from "./CodeMirrorExtensionManager";
import { DatabaseAPI } from "./DatabaseAPI";
import { EditorSyncManager } from "./EditorSyncManager";
import type { IManager } from "./IManager";
import { ObsidianEventManager } from "./ObsidianEventManager";
import { PluginEventManager } from "./PluginEventManager";
import { SettingsManager } from "./SettingsManager";
import { ViewManager } from "./ViewManager";

const logger = log.getLogger("AppOrchestrator");

/**
 * Manages the lifecycle and coordination of all sub-managers.
 */
export class AppOrchestrator implements IManager {
	protected plugin: SandboxNotePlugin;
	protected emitter: EventEmitter<AppEvents>;

	// Sub-managers
	protected settingsManager: SettingsManager;
	protected cacheManager: CacheManager;
	protected pluginEventManager: PluginEventManager;
	protected editorSyncManager: EditorSyncManager;
	protected cmExtensionManager: CodeMirrorExtensionManager;
	protected viewManager: ViewManager;
	protected obsidianEventManager: ObsidianEventManager;
	protected databaseAPI!: DatabaseAPI;
	protected dbManager!: DatabaseManager;

	private subManagers: IManager[] = [];

	constructor(plugin: SandboxNotePlugin, emitter: EventEmitter<AppEvents>) {
		this.plugin = plugin;
		this.emitter = emitter;
		this.databaseAPI = new DatabaseAPI();

		// --- Initialize all managers here ---
		this.cacheManager = new CacheManager(emitter, this.databaseAPI); // 順番
		this.settingsManager = new SettingsManager({
			emitter,
			loadData: plugin.loadData.bind(plugin),
			saveData: plugin.saveData.bind(plugin),
		});
		this.viewManager = new ViewManager({
			registerView: (type, viewCreator) =>
				plugin.registerView(type, viewCreator),
			createView: (leaf) =>
				new HotSandboxNoteView(leaf, {
					emitter: this.emitter,
					getSettings: this.settingsManager.getSettings.bind(
						this.settingsManager
					),
					indexOfMasterId: this.viewManager.indexOfMasterId.bind(
						this.viewManager
					),
					isLastHotView: this.viewManager.isLastHotView.bind(
						this.viewManager
					),
				}),
			getLeaf: (type) => plugin.app.workspace.getLeaf(type),
			detachLeavesOfType: (type) =>
				plugin.app.workspace.detachLeavesOfType(type),
			getActiveViewOfType: (type) =>
				plugin.app.workspace.getActiveViewOfType(type),
			getLeavesOfType: (type: string) =>
				plugin.app.workspace.getLeavesOfType(type),
			getAllNotes: this.cacheManager.getAllSandboxes.bind(
				this.cacheManager
			),
		});
		this.dbManager = new DatabaseManager({
			dbAPI: this.databaseAPI,
			cache: {
				get: this.cacheManager.get.bind(this.cacheManager),
				set: this.cacheManager.updateNoteContent.bind(
					this.cacheManager
				),
				delete: this.cacheManager.delete.bind(this.cacheManager),
			},
			emitter,
			getAllHotSandboxViews: this.viewManager.getAllViews.bind(
				this.viewManager
			),
		});
		this.editorSyncManager = new EditorSyncManager({
			emitter: this.emitter,
			getAllHotSandboxViews: this.viewManager.getAllViews.bind(
				this.viewManager
			),
			getAllNotes: this.cacheManager.getAllSandboxes.bind(
				this.cacheManager
			),
			registerNewNote: this.cacheManager.registerNewNote.bind(
				this.cacheManager
			),
			getNoteContent: this.cacheManager.getNoteContent.bind(
				this.cacheManager
			),
			getActiveView: this.viewManager.getActiveView.bind(
				this.viewManager
			),
			workspace: this.plugin.app.workspace as never,
		});
		this.cmExtensionManager = new CodeMirrorExtensionManager({
			emitter: this.emitter,
			plugin: this.plugin,
		});
		this.pluginEventManager = new PluginEventManager({
			applyLogger: plugin.applyLogger.bind(plugin),
			cache: this.cacheManager,
			emitter,
			settings: this.settingsManager,
			connectEditorPluginToView: (leaf) => {
				this.cmExtensionManager.connectEditorPluginToView(leaf);
			},
			saveSandbox: this.dbManager.debouncedSaveSandboxes.bind(
				this.dbManager
			),
			clearAllDeadSandboxes: this.dbManager.clearAllDeadSandboxes.bind(
				this.dbManager
			),
			getAllViews: this.viewManager.getAllViews.bind(this.viewManager),
		});
		this.obsidianEventManager = new ObsidianEventManager(
			{
				getActiveView: this.viewManager.getActiveView.bind(
					this.viewManager
				),
				workspaceEvents: plugin.app.workspace,
			},
			emitter
		);

		this.subManagers.push(
			this.editorSyncManager,
			this.cmExtensionManager,
			this.viewManager,
			this.obsidianEventManager,
			this.cacheManager,
			this.settingsManager,
			this.pluginEventManager
		);
	}

	async load(): Promise<void> {
		for (const manager of this.subManagers) {
			manager.load();
		}

		logger.debug(
			"AppOrchestrator and all sub-managers loaded successfully."
		);
	}

	unload(): void {
		// Unload in reverse order of loading
		for (const manager of [...this.subManagers].reverse()) {
			manager.unload();
		}

		logger.debug(
			"AppOrchestrator and all sub-managers unloaded successfully."
		);
	}

	// --- Delegated Methods ---

	getActiveView() {
		return this.viewManager.getActiveView();
	}

	getAllView() {
		return this.viewManager.getAllViews();
	}

	activateView() {
		return this.viewManager.activateView();
	}

	getSettings() {
		return this.settingsManager.getSettings();
	}

	async updateSettings(
		settings: Parameters<SettingsManager["updateSettingsAndSave"]>[0]
	) {
		await this.settingsManager.updateSettingsAndSave(settings);
	}
}
