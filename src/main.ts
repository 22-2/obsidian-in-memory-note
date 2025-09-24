import { Notice, Plugin } from "obsidian";
import {
	type SandboxNotePluginData,
	SandboxNoteSettingTab,
} from "./settings";
import {
	DEFAULT_DATA as DEFAULT_PLUGIN_DATA,
} from "./utils/constants";
import log from "loglevel";
import { EventEmitter } from "./utils/EventEmitter";
import type { AppEvents } from "./events/AppEvents";
import { EditorSyncManager } from "./managers/EditorSyncManager";
import { EditorPluginConnector } from "./managers/EditorPluginConnector";
import { SaveManager } from "./managers/SaveManager";
import { InteractionManager } from "./managers/InteractionManager";
import { EventManager } from "./managers/EventManager";
import { ViewFactory } from "./managers/ViewFactory";
import { WorkspaceEventManager } from "./managers/WorkspaceEventManager";
import type { SandboxNoteView } from "./views/SandboxNoteView";
import type { Manager } from "./managers/Manager";

/** Main plugin class for Sandbox Note functionality. */
export default class SandboxNotePlugin extends Plugin {
	data: SandboxNotePluginData = DEFAULT_PLUGIN_DATA;

	// Managers
	editorSyncManager!: EditorSyncManager;
	saveManager!: SaveManager;
	interactionManager!: InteractionManager;
	editorPluginConnector!: EditorPluginConnector;
	viewFactory!: ViewFactory;
	eventManager!: EventManager;
	workspaceEventManager!: WorkspaceEventManager;
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

		// Initialize content manager with saved content
		const savedContent = this.data.data.noteContent ?? "";
		this.editorSyncManager.currentSharedNoteContent = savedContent;
		this.editorSyncManager.lastSavedContent = savedContent;

		this.setupSettingsTab();

		log.debug("Sandbox Note plugin loaded");
	}

	/** Initialize all manager instances */
	private initializeManagers() {
		const saveData = (data: SandboxNotePluginData) => this.saveData(data);
		const emitter = new EventEmitter<AppEvents>();
		this.emitter = emitter;

		this.editorSyncManager = new EditorSyncManager(emitter);
		this.saveManager = new SaveManager(emitter, this.data, saveData);
		this.interactionManager = new InteractionManager(this);
		this.editorPluginConnector = new EditorPluginConnector(this, emitter);
		this.viewFactory = new ViewFactory(this);
		this.workspaceEventManager = new WorkspaceEventManager(
			this.app,
			emitter,
			this.editorSyncManager,
			this.editorPluginConnector,
			this.data.settings
		);
		this.eventManager = new EventManager(
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

	/** Initialize logger with current settings. */
	initializeLogger(): void {
		if (this.data.settings.enableLogger) {
			log.enableAll();
		} else {
			log.disableAll();
		}
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
