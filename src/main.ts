import { Notice, Plugin } from "obsidian";
import {
	type SandboxNotePluginSettings,
	SandboxNoteSettingTab,
} from "./settings";
import { UnsafeMarkdownView } from "./views/helpers/UnsafeMarkdownView";
import { noop } from "./utils";
import { DEFAULT_SETTINGS } from "./utils/constants";
import log from "loglevel";
import { EventEmitter } from "./utils/EventEmitter";
import type { AppEvents } from "./events/AppEvents";
import { EditorSyncManager } from "./managers/EditorSyncManager";
import { EditorPluginConnector } from "./managers/EditorPluginConnector";
import { SaveManager } from "./managers/SaveManager";
import { UIManager } from "./managers/UIManager";
import { EventManager } from "./managers/EventManager";
import { ViewActivator } from "./managers/ViewActivator";
import { WorkspaceEventManager } from "./managers/WorkspaceEventManager";
import type { WorkspaceLeaf } from "obsidian";
import type { SandboxNoteView } from "./views/SandboxNoteView";

/** Main plugin class for Sandbox Note functionality. */
export default class SandboxNotePlugin extends Plugin {
	settings: SandboxNotePluginSettings = DEFAULT_SETTINGS;

	// Managers
	editorSyncManager!: EditorSyncManager;
	saveManager!: SaveManager;
	uiManager!: UIManager;
	editorPluginConnector!: EditorPluginConnector;
	viewActivator!: ViewActivator;
	eventManager!: EventManager;
	workspaceEventManager!: WorkspaceEventManager;
	emitter!: EventEmitter<AppEvents>;

	/** Initialize plugin on load. */
	async onload() {
		if (!this.checkCompatibility()) {
			new Notice(
				"Sandbox Note plugin: Incompatible with this version of Obsidian. The plugin has been disabled."
			);
			return;
		}

		await this.loadSettings();
		this.initializeLogger();
		this.initializeManagers();
		this.eventManager.registerEventHandlers(
			this.editorSyncManager,
			this.saveManager
		);

		// Initialize content manager with saved content
		const savedContent = this.settings.noteContent ?? "";
		this.editorSyncManager.currenSharedNoteContent = savedContent;
		this.editorSyncManager.lastSavedContent = savedContent;

		this.setupSettingsTab();
		this.editorPluginConnector.setupEditorExtension();
		this.uiManager.setupUserInterface();
		this.viewActivator.registerViews();
		this.workspaceEventManager.setupEventHandlers();

		log.debug("Sandbox Note plugin loaded");
	}

	/**
	 * Checks if the plugin is compatible with the current version of Obsidian.
	 * @returns {boolean} True if compatible, false otherwise.
	 */
	private checkCompatibility(): boolean {
		// This plugin relies on a specific internal structure of MarkdownView
		// to create an editor without a file. This check attempts to create a
		// dummy view to see if the required APIs are available.
		try {
			const dummyEl = createDiv("div");
			const leaf = {
				...(this.app.workspace.activeLeaf ?? {}),
				containerEl: dummyEl,
				getRoot: () => this.app.workspace.rootSplit,
				getHistoryState: () => ({}),
				open: noop,
				updateHeader: noop,
				workspace: {},
			} as unknown as WorkspaceLeaf;

			// @ts-ignore
			const view = new UnsafeMarkdownView(leaf, null);

			view.unload();
			dummyEl.remove();

			return true;
		} catch (error) {
			log.error(
				"Sandbox Note plugin: Compatibility check failed. This is likely due to an Obsidian update.",
				error
			);
			return false;
		}
	}

	/** Initialize all manager instances */
	private initializeManagers() {
		const saveData = (settings: SandboxNotePluginSettings) =>
			this.saveData(settings);
		const emitter = new EventEmitter<AppEvents>();
		this.emitter = emitter;

		this.editorSyncManager = new EditorSyncManager(emitter);
		this.saveManager = new SaveManager(emitter, this.settings, saveData);
		this.uiManager = new UIManager(this);
		this.editorPluginConnector = new EditorPluginConnector(this, emitter);
		this.viewActivator = new ViewActivator(this);
		this.workspaceEventManager = new WorkspaceEventManager(
			this.app,
			emitter,
			this.editorSyncManager,
			this.editorPluginConnector,
			this.settings
		);
		this.eventManager = new EventManager(emitter);
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
		log.debug("Sandbox Note plugin unloaded");
	}

	/** Create and activate new Sandbox Note view. */
	async activateSandboxView() {
		return this.viewActivator.activateSandboxView();
	}

	/** Create and activate new In-Memory Note view. */
	async activateInMemoryView() {
		return this.viewActivator.activateInMemoryView();
	}

	/** Initialize logger with current settings. */
	initializeLogger(): void {
		if (this.settings.enableLogger) {
			log.enableAll();
		} else {
			log.disableAll();
		}
		log.debug("Logger initialized");
	}

	/** Load plugin settings from storage. */
	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	/** Save current plugin settings to storage. */
	async saveSettings() {
		const settingsToSave = {
			...this.settings,
			noteContent: this.editorSyncManager.currenSharedNoteContent,
		};
		await this.saveData(settingsToSave);
		// Refresh all view titles when settings change
		this.editorSyncManager.refreshAllViewTitles();
	}
}
