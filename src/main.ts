import log from "loglevel";
import { Plugin } from "obsidian";
import type { AppEvents } from "./events/AppEvents";
import { EditorPluginConnector } from "./managers/EditorPluginConnector";
import { EditorSyncManager } from "./managers/EditorSyncManager";
import { AppEventManager } from "./managers/AppEventManager";
import { InteractionManager } from "./managers/InteractionManager";
import type { Manager } from "./managers/Manager";
import { SaveManager } from "./managers/SaveManager";
import { ViewFactory } from "./managers/ViewFactory";
import { ObsidianEventManager } from "./managers/ObsidianEventManager";
import { type SandboxNotePluginData, SandboxNoteSettingTab } from "./settings";
import { DEFAULT_PLUGIN_DATA } from "./utils/constants";
import { EventEmitter } from "./utils/EventEmitter";
import { SandboxNoteView } from "./views/SandboxNoteView";
import { AbstractNoteView } from "./views/internal/AbstractNoteView";
import { DatabaseManager } from "./managers/DatabaseManager";
import { HotSandboxNoteView } from "./views/HotSandboxNoteView";
import "./utils/setup-logger";

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
	eventManager!: AppEventManager;
	workspaceEventManager!: ObsidianEventManager;
	emitter!: EventEmitter<AppEvents>;
	managers: Manager[] = [];

	/** Initialize plugin on load. */
	async onload() {
		await this.loadSettings();
		this.initializeLogger();
		this.initializeManagers();

		for (const manager of this.managers) {
			manager.load();
		}

		await this.restoreHotNotes();

		// Initialize content manager with saved content for original sandbox
		const savedContent = this.data.data.noteContent ?? "";
		this.editorSyncManager.currentSharedNoteContent = savedContent;
		this.editorSyncManager.lastSavedContent = savedContent;

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

	public getActiveSandboxNoteView() {
		return this.app.workspace.getActiveViewOfType(SandboxNoteView);
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
		this.workspaceEventManager = new ObsidianEventManager(
			this,
			emitter,
			this.editorSyncManager,
			this.editorPluginConnector,
			this.data.settings
		);
		this.eventManager = new AppEventManager(
			emitter,
			this.editorSyncManager,
			this.saveManager,
			this.data.settings
		);

		this.managers.push(
			this.editorSyncManager,
			this.saveManager,
			this.interactionManager,
			this.editorPluginConnector,
			this.viewFactory,
			this.workspaceEventManager,
			this.eventManager
		);
	}

	/** Setup plugin settings tab. */
	private setupSettingsTab() {
		this.addSettingTab(new SandboxNoteSettingTab(this));
	}

	/** Update shared content and sync across all views. */
	updateNoteContent(content: string, sourceView: SandboxNoteView) {
		this.editorSyncManager.syncAll(content, sourceView);
	}

	/** Cleanup on plugin unload. */
	async onunload() {
		for (const manager of this.managers) {
			manager.unload();
		}
		this.databaseManager.close();
		log.debug("Sandbox Note plugin unloaded");
	}

	/** Create and activate new Sandbox Note view. */
	async activateSandboxView() {
		return this.viewFactory.activateSandboxView();
	}

	/** Create and activate new In-Memory Note view. */
	async activateInMemoryView() {
		return this.viewFactory.activateInMemoryView();
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
		await this.saveManager.saveSettings(this.data.settings, {
			noteContent: this.editorSyncManager.currentSharedNoteContent,
			lastSaved: this.editorSyncManager.lastSavedContent,
		});
		// Refresh all view titles when settings change
		this.editorSyncManager.refreshAllViewTitles();
	}
}
