import log from "loglevel";
import { Plugin } from "obsidian";
import type { AppEvents } from "./events/AppEvents";
import { DatabaseManager } from "./managers/DatabaseManager";
import { EditorPluginConnector } from "./managers/EditorPluginConnector";
import { EditorSyncManager } from "./managers/EditorSyncManager";
import { InteractionManager } from "./managers/InteractionManager";
import type { Manager } from "./managers/Manager";
import { ObsidianEventManager } from "./managers/ObsidianEventManager";
import { SaveManager } from "./managers/SaveManager";
import { ViewFactory } from "./managers/ViewFactory";
import { type SandboxNotePluginData, SandboxNoteSettingTab } from "./settings";
import { DEFAULT_PLUGIN_DATA } from "./utils/constants";
import { EventEmitter } from "./utils/EventEmitter";
import "./utils/setup-logger";
import { overwriteLogLevel } from "./utils/setup-logger";
import { HotSandboxNoteView } from "./views/HotSandboxNoteView";
import { AbstractNoteView } from "./views/internal/AbstractNoteView";

/** Main plugin class for Sandbox Note functionality. */
export default class SandboxNotePlugin extends Plugin {
	data: SandboxNotePluginData = DEFAULT_PLUGIN_DATA;

	// Managers
	databaseManager!: DatabaseManager;
	editorSyncManager!: EditorSyncManager;
	saveManager!: SaveManager;
	interactionManager!: InteractionManager;
	editorPluginConnector!: EditorPluginConnector;
	viewFactory!: ViewFactory;
	workspaceEventManager!: ObsidianEventManager;
	emitter!: EventEmitter<AppEvents>;
	managers: Manager[] = [];

	/** Initialize plugin on load. */
	async onload() {
		overwriteLogLevel();
		await this.loadSettings();
		this.initializeLogger();
		this.initializeManagers();

		for (const manager of this.managers) {
			manager.load();
		}

		await this.restoreHotNotes();

		this.setupSettingsTab();

		log.debug("Sandbox Note plugin loaded");
	}

	private async restoreHotNotes() {
		const allNotes = await this.databaseManager.getAllNotes();
		this.editorSyncManager.setInitialHotNotes(allNotes);
		log.debug(`Restored ${allNotes.length} hot sandbox notes from DB.`);
	}

	public getActiveAbstractNoteView() {
		return (
			this.app.workspace.getActiveViewOfType(AbstractNoteView) ??
			this.app.workspace.getActiveViewOfType(HotSandboxNoteView)
		);
	}

	/** Initialize all manager instances */
	private initializeManagers() {
		const saveData = (data: SandboxNotePluginData) => this.saveData(data);
		const emitter = new EventEmitter<AppEvents>();
		this.emitter = emitter;
		this.databaseManager = new DatabaseManager();

		this.editorSyncManager = new EditorSyncManager(emitter);
		this.saveManager = new SaveManager(
			emitter,
			this.data,
			saveData,
			this.databaseManager
		);
		this.interactionManager = new InteractionManager(this);
		this.editorPluginConnector = new EditorPluginConnector(this, emitter);
		this.viewFactory = new ViewFactory(this);
		this.workspaceEventManager = new ObsidianEventManager(this, emitter);

		// Event listeners that bridge views and managers
		this.emitter.on("connect-editor-plugin", (payload) => {
			this.editorPluginConnector.connectEditorPluginToView(payload.view);
		});
		this.emitter.on("register-new-hot-note", (payload) => {
			this.editorSyncManager.registerNewHotNote(payload.noteGroupId);
		});

		this.managers.push(
			this.editorSyncManager,
			this.saveManager,
			this.interactionManager,
			this.editorPluginConnector,
			this.viewFactory,
			this.workspaceEventManager
		);
	}

	/** Setup plugin settings tab. */
	private setupSettingsTab() {
		this.addSettingTab(new SandboxNoteSettingTab(this));
	}

	/** Cleanup on plugin unload. */
	async onunload() {
		for (const manager of this.managers) {
			manager.unload();
		}
		this.databaseManager.close();
		log.debug("Sandbox Note plugin unloaded");
	}

	async activateNewHotSandboxView() {
		return this.viewFactory.activateNewHotSandboxView();
	}

	/** Initialize logger with current settings. */
	initializeLogger(): void {
		this.data.settings.enableLogger
			? log.setLevel("debug")
			: log.setLevel("warn");
		log.debug("Logger initialized");
	}

	public getGroupNumberForNote(noteGroupId: string): number {
		return this.editorSyncManager.getGroupNumber(noteGroupId);
	}

	/** Load plugin settings from storage. */
	async loadSettings() {
		this.data = Object.assign(
			{},
			DEFAULT_PLUGIN_DATA,
			await this.loadData()
		);
	}

	/** Save current plugin settings to storage. */
	async saveSettings() {
		await this.saveManager.saveSettings(this.data.settings);
		// Refresh all view titles when settings change
		this.editorSyncManager.refreshAllViewTitles();
	}
}
