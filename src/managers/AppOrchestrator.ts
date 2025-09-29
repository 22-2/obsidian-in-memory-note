import log from "loglevel";
import type { AppEvents } from "src/events/AppEvents";
import type SandboxNotePlugin from "src/main";
import type { SandboxNotePluginData } from "src/settings";
import { DEFAULT_PLUGIN_DATA } from "src/utils/constants";
import type { EventEmitter } from "src/utils/EventEmitter";
import { DatabaseController } from "src/managers/DatabaseController";
import { AppEventManager } from "./AppEventManager";
import { DatabaseAPI } from "./DatabaseAPI";
import { EditorPluginConnector } from "./EditorPluginConnector";
import { EditorSyncManager } from "./EditorSyncManager";
import { CacheManager } from "./CacheManager";
import type { Manager } from "./Manager";
import { ObsidianEventManager } from "./ObsidianEventManager";
import { SettingsManager } from "./SettingsManager";
import { ViewFactory } from "./ViewFactory";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";

const logger = log.getLogger("AppOrchestrator");

/**
 * Manages the lifecycle and coordination of all sub-managers.
 */
export class AppOrchestrator implements Manager {
	protected plugin: SandboxNotePlugin;
	protected emitter: EventEmitter<AppEvents>;

	// Sub-managers
	protected settingsManager: SettingsManager;
	protected cacheManager: CacheManager;
	protected appEventManager: AppEventManager;
	protected editorSyncManager: EditorSyncManager;
	protected editorPluginConnector: EditorPluginConnector;
	protected viewFactory: ViewFactory;
	protected obsidianEventManager: ObsidianEventManager;
	protected databaseAPI!: DatabaseAPI;
	protected dbController!: DatabaseController;

	private subManagers: Manager[] = [];

	constructor(plugin: SandboxNotePlugin, emitter: EventEmitter<AppEvents>) {
		this.plugin = plugin;
		this.emitter = emitter;
		this.databaseAPI = new DatabaseAPI();

		// --- Initialize all managers here ---
		this.settingsManager = new SettingsManager(emitter, plugin);
		this.cacheManager = new CacheManager(emitter, this.databaseAPI);
		this.dbController = new DatabaseController(
			this.databaseAPI,
			{
				get: this.cacheManager.getNoteData.bind(this.cacheManager),
				set: this.cacheManager.updateNoteContent.bind(
					this.cacheManager
				),
				delete: this.cacheManager.deleteNoteData.bind(
					this.cacheManager
				),
			},
			emitter
		);

		this.viewFactory = new ViewFactory({
			registerView: (type, viewFactory) =>
				plugin.registerView(type, viewFactory),
			createView: (leaf) =>
				new HotSandboxNoteView(leaf, {
					emitter: this.emitter,
					getSettings: this.settingsManager.getSettings.bind(
						this.settingsManager
					),
					indexOfMasterId: this.viewFactory.indexOfMasterId.bind(
						this.viewFactory
					),
					isLastHotView: this.viewFactory.isLastHotView.bind(
						this.viewFactory
					),
				}),
			getLeaf: (type) => plugin.app.workspace.getLeaf(type),
			detachLeavesOfType: (type) =>
				plugin.app.workspace.detachLeavesOfType(type),
			getActiveViewOfType: (type) =>
				plugin.app.workspace.getActiveViewOfType(type),
			getLeavesOfType: (type: string) =>
				plugin.app.workspace.getLeavesOfType(type),
			getAllNotes: this.cacheManager.getAllNotes.bind(this.cacheManager),
		});
		this.editorSyncManager = new EditorSyncManager({
			emitter: this.emitter,
			getAllHotSandboxViews: this.viewFactory.getAllHotSandboxViews.bind(
				this.viewFactory
			),
			getAllNotes: this.cacheManager.getAllNotes.bind(this.cacheManager),
			registerNewNote: this.cacheManager.registerNewNote.bind(
				this.cacheManager
			),
			getNoteContent: this.cacheManager.getNoteContent.bind(
				this.cacheManager
			),
		});
		this.editorPluginConnector = new EditorPluginConnector({
			emitter: this.emitter,
			getActiveView: this.viewFactory.getActiveView.bind(
				this.viewFactory
			),
			plugin: this.plugin,
		});

		this.appEventManager = new AppEventManager({
			applyLogger: plugin.applyLogger.bind(plugin),
			cache: this.cacheManager,
			emitter,
			settings: this.settingsManager,
			connectEditorPluginToView: (leaf) => {
				this.editorPluginConnector.connectEditorPluginToView(leaf);
			},
			saveSandbox: this.dbController.saveToDatabase.bind(
				this.dbController
			),
		});

		this.obsidianEventManager = new ObsidianEventManager(
			{
				getActiveView: this.viewFactory.getActiveView.bind(
					this.viewFactory
				),
				workspaceEvents: plugin.app.workspace,
			},
			emitter
		);

		this.subManagers.push(
			this.editorSyncManager,
			this.editorPluginConnector,
			this.viewFactory,
			this.obsidianEventManager,
			this.cacheManager,
			this.settingsManager,
			this.appEventManager
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
		return this.viewFactory.getActiveView();
	}

	activateNewHotSandboxView() {
		return this.viewFactory.activateNewHotSandboxView();
	}

	getSettings() {
		return this.settingsManager.getSettings();
	}

	async updateSettings(
		settings: Parameters<SettingsManager["updateSettingsAndSave"]>[0]
	) {
		await this.settingsManager.updateSettingsAndSave(settings);
	}

	getAllNotes() {
		return this.cacheManager.getAllNotes();
	}

	getNoteContent(masterNoteId: string) {
		return this.cacheManager.getNoteContent(masterNoteId);
	}

	registerNewNote(masterNoteId: string) {
		this.cacheManager.registerNewNote(masterNoteId);
	}

	getNoteData(masterNoteId: string) {
		return this.cacheManager.getNoteData(masterNoteId);
	}
}
