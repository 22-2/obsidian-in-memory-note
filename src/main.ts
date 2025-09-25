import log from "loglevel";
import { Plugin } from "obsidian";
import type { AppEvents } from "./events/AppEvents";
import { DatabaseManager } from "./managers/DatabaseManager";
import { EditorPluginConnector } from "./managers/EditorPluginConnector";
import { EditorSyncManager } from "./managers/EditorSyncManager";
import type { Manager } from "./managers/Manager";
import { ObsidianEventManager } from "./managers/ObsidianEventManager";
import { StateManager } from "./managers/StateManager";
import { ViewFactory } from "./managers/ViewFactory";
import { type SandboxNotePluginData, SandboxNoteSettingTab } from "./settings";
import { DEFAULT_PLUGIN_DATA, HOT_SANDBOX_NOTE_ICON } from "./utils/constants";
import { EventEmitter } from "./utils/EventEmitter";
import "./utils/setup-logger";
import { overwriteLogLevel } from "./utils/setup-logger";
import { HotSandboxNoteView } from "./views/HotSandboxNoteView";
import { AbstractNoteView } from "./views/internal/AbstractNoteView";
import { convertToFileAndClear } from "./views/internal/utils";

/** Main plugin class for Sandbox Note functionality. */
export default class SandboxNotePlugin extends Plugin {
	// Managers
	databaseManager!: DatabaseManager;
	stateManager!: StateManager;
	editorSyncManager!: EditorSyncManager;
	editorPluginConnector!: EditorPluginConnector;
	viewFactory!: ViewFactory;
	workspaceEventManager!: ObsidianEventManager;
	emitter!: EventEmitter<AppEvents>;
	managers: Manager[] = [];

	/** Initialize plugin on load. */
	async onload() {
		overwriteLogLevel();
		this.initializeManagers();

		// Load all data via StateManager
		await this.stateManager.load();

		// Initialize logger based on loaded settings
		this.initializeLogger();

		// Load other managers
		for (const manager of this.managers) {
			// StateManager is already loaded
			if (manager !== this.stateManager) {
				manager.load();
			}
		}

		this.setupSettingsTab();
		this.setupCommandsAndRibbons();

		log.debug("Sandbox Note plugin loaded");
	}

	public getActiveAbstractNoteView() {
		return (
			this.app.workspace.getActiveViewOfType(AbstractNoteView) ??
			this.app.workspace.getActiveViewOfType(HotSandboxNoteView)
		);
	}

	/** Initialize all manager instances */
	private initializeManagers() {
		const emitter = new EventEmitter<AppEvents>();
		this.emitter = emitter;
		this.databaseManager = new DatabaseManager();

		// StateManager must be initialized first as others depend on it
		this.stateManager = new StateManager(
			this,
			emitter,
			this.databaseManager
		);
		this.editorSyncManager = new EditorSyncManager(
			emitter,
			this.stateManager
		);
		this.editorPluginConnector = new EditorPluginConnector(this, emitter);
		this.viewFactory = new ViewFactory(this);
		this.workspaceEventManager = new ObsidianEventManager(this, emitter);

		// Event listeners that bridge views and managers
		this.emitter.on("connect-editor-plugin", (payload) => {
			this.editorPluginConnector.connectEditorPluginToView(payload.view);
		});
		this.emitter.on("register-new-hot-note", (payload) => {
			this.stateManager.registerNewHotNote(payload.masterNoteId);
		});
		this.emitter.on("settings-changed", () => {
			this.initializeLogger();
		});

		this.managers.push(
			this.stateManager,
			this.editorSyncManager,
			this.editorPluginConnector,
			this.viewFactory,
			this.workspaceEventManager
		);
	}

	/** Setup plugin settings tab. */
	private setupSettingsTab() {
		this.addSettingTab(new SandboxNoteSettingTab(this));
	}

	private setupCommandsAndRibbons() {
		// Command to open the new hot sandbox note
		this.addCommand({
			id: "open-hot-sandbox-note-view",
			name: "Open new hot sandbox note",
			icon: HOT_SANDBOX_NOTE_ICON,
			callback: () => {
				this.activateNewHotSandboxView();
			},
		});

		this.addCommand({
			id: "convert-to-file",
			name: "Convert to file",
			icon: "file-pen-line",
			checkCallback: (checking) => {
				const view = this.getActiveAbstractNoteView();
				if (view) {
					if (!checking) {
						convertToFileAndClear(view);
					}
					return true;
				}
				return false;
			},
		});

		// Ribbon icon to open the hot sandbox note
		this.addRibbonIcon(
			HOT_SANDBOX_NOTE_ICON,
			"Open new hot sandbox note",
			() => {
				this.activateNewHotSandboxView();
			}
		);
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
		// StateManager might not be initialized on the very first call, so we check for it.
		const settings = this.stateManager?.getSettings();
		if (settings) {
			settings.enableLogger
				? log.setLevel("debug")
				: log.setLevel("warn");
		} else {
			log.setLevel("warn");
		}
		log.debug("Logger initialized");
	}
}
