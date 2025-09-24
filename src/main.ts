import log from "loglevel";
import { Plugin } from "obsidian";
import type { AppEvents } from "./events/AppEvents";
import { EditorPluginConnector } from "./managers/EditorPluginConnector";
import { EditorSyncManager } from "./managers/EditorSyncManager";
import { EventManager } from "./managers/EventManager";
import { InteractionManager } from "./managers/InteractionManager";
import type { Manager } from "./managers/Manager";
import { SaveManager } from "./managers/SaveManager";
import { ViewFactory } from "./managers/ViewFactory";
import { WorkspaceEventManager } from "./managers/WorkspaceEventManager";
import { type SandboxNotePluginData, SandboxNoteSettingTab } from "./settings";
import { DEFAULT_DATA as DEFAULT_PLUGIN_DATA } from "./utils/constants";
import { EventEmitter } from "./utils/EventEmitter";
import { SandboxNoteView } from "./views/SandboxNoteView";

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
		// main.ts の onload 内に追加
		// this.app.workspace.onLayoutReady(() => {
		// 	this.register(
		// 		around(this.app.commands.commands["editor:toggle-source"], {
		// 			checkCallback: (original) => {
		// 				return (checking) => {
		// 					console.log(
		// 						"--- Toggle Source Command Triggered ---"
		// 					);
		// 					console.log(
		// 						"Active Leaf:",
		// 						this.app.workspace.activeLeaf?.view.getViewType()
		// 					);
		// 					// @ts-ignore
		// 					const activeEditor =
		// 						this.app.workspace.activeEditor;
		// 					console.log("Active Editor:", activeEditor);
		// 					if (activeEditor) {
		// 						console.log(
		// 							"Active Editor's Leaf:",
		// 							activeEditor.leaf
		// 						);
		// 					}
		// 					return original?.call(null, checking);
		// 				};
		// 			},
		// 		})
		// 	);
		// });
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
			this, // Pass the plugin instance instead of `this.app`
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
