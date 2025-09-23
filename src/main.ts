import { debounce, Notice, Plugin, WorkspaceLeaf } from "obsidian";
import {
	type SandboxNotePluginSettings,
	SandboxNoteSettingTab,
} from "./settings";
import { UnsafeMarkdownView } from "./views/helpers/UnsafeMarkdownView";
import { noop } from "./utils";
import {
	DEFAULT_SETTINGS,
	VIEW_TYPE_SANDBOX,
	VIEW_TYPE_IN_MEMORY,
} from "./utils/constants";
import { activateView } from "./utils/obsidian";
import { SandboxNoteView } from "./views/SandboxNoteView";
import { InMemoryNoteView } from "./views/InMemoryNoteView";
import log from "loglevel";
import { EditorSyncManager } from "./managers/EditorSyncManager";
import { EditorPluginConnector } from "./managers/EditorPluginConnector";
import { SaveManager } from "./managers/SaveManager";
import { UIManager } from "./managers/UIManager";

/** Main plugin class for Sandbox Note functionality. */
export default class SandboxNotePlugin extends Plugin {
	settings: SandboxNotePluginSettings = DEFAULT_SETTINGS;

	// Managers
	editorSyncManager!: EditorSyncManager;
	saveManager!: SaveManager;
	uiManager!: UIManager;
	editorPluginConnector!: EditorPluginConnector;

	debouncedSetupSandboxViews = () => {};

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
		this.editorSyncManager.sharedNoteContent =
			this.settings.noteContent ?? "";
		this.setupSettingsTab();
		this.editorPluginConnector.setupEditorExtension();
		this.setupWorkspaceEventHandlers();
		this.registerViewType();
		this.uiManager.setupUserInterface();
		// this.commandManager.updateSaveCommandMonkeyPatch();
		this.app.workspace.onLayoutReady(() => this.setupSandboxViews());
		this.debouncedSetupSandboxViews = debounce(
			this.setupSandboxViews.bind(this),
			50
		);
		this.app.workspace.on("layout-change", this.debouncedSetupSandboxViews);
		log.debug("Sandbox Note plugin loaded");
	}

	/** Fires once the workspace is ready. */
	private setupSandboxViews(): void {
		log.debug("Workspace layout ready.");
		// Connect to any existing sandbox views that were restored on startup
		this.editorSyncManager.activeViews.forEach((view) => {
			log.debug(
				`Connecting to existing view on layout ready: ${view.getViewType()}`
			);
			this.editorPluginConnector.connectEditorPluginToView(view);
		});
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
		this.editorSyncManager = new EditorSyncManager(this);
		this.saveManager = new SaveManager(this);
		this.uiManager = new UIManager(this);
		// this.commandManager = new CommandManager(this);
		this.editorPluginConnector = new EditorPluginConnector(this);
	}

	/** Setup plugin settings tab. */
	private setupSettingsTab() {
		this.addSettingTab(new SandboxNoteSettingTab(this));
	}

	/** Setup workspace event handlers. */
	private setupWorkspaceEventHandlers() {
		this.app.workspace.on("active-leaf-change", () => {
			this.handleActiveLeafChange();
		});
	}

	/** Handle active leaf changes and auto-save if enabled. */
	private handleActiveLeafChange() {
		const activeView =
			this.app.workspace.getActiveViewOfType(SandboxNoteView);

		// Delegate to save manager
		this.editorSyncManager;

		// Connect the editor plugin to the new active view
		if (activeView instanceof SandboxNoteView) {
			this.editorPluginConnector.connectEditorPluginToView(activeView);
		}
	}

	/** Register custom view type. */
	private registerViewType() {
		this.registerView(
			VIEW_TYPE_SANDBOX,
			(leaf) => new SandboxNoteView(leaf, this)
		);
		this.registerView(
			VIEW_TYPE_IN_MEMORY,
			(leaf) => new InMemoryNoteView(leaf, this)
		);
	}

	/** Update shared content and sync across all views. */
	updateNoteContent(content: string, sourceView: SandboxNoteView) {
		this.editorSyncManager.syncAll(content, sourceView);
	}

	/** Cleanup on plugin unload. */
	async onunload() {
		log.debug("Sandbox Note plugin unloaded");
		// The `around` utility automatically registers a cleanup function
		// that reverts the monkey patch when the plugin is unloaded.
		// No manual unpatching is required here.
	}

	/** Create and activate new Sandbox Note view. */
	async activateSandboxView() {
		return this.activateAbstractView(VIEW_TYPE_SANDBOX);
	}

	/** Create and activate new In-Memory Note view. */
	async activateInMemoryView() {
		return this.activateAbstractView(VIEW_TYPE_IN_MEMORY);
	}

	private async activateAbstractView(type: string) {
		const leaf = await activateView(this.app, {
			type,
			active: true,
		});

		return leaf;
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
			noteContent: this.editorSyncManager.sharedNoteContent,
		};
		await this.saveData(settingsToSave);
		// Refresh all view titles when settings change
		this.editorSyncManager.refreshAllViewTitles();
	}
}
