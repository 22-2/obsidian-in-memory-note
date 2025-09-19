import { Plugin } from "obsidian";
import {
	type SandboxNotePluginSettings,
	SandboxNoteSettingTab,
} from "./settings";
import { DEFAULT_SETTINGS, VIEW_TYPE } from "./utils/constants";
import { DirectLogger } from "./utils/logging";
import { activateView } from "./utils/obsidian";
import { SandboxNoteView } from "./view";
import { ContentManager } from "./managers/contentManager";
import { SaveManager } from "./managers/saveManager";
import { UIManager } from "./managers/uiManager";
import { CommandManager } from "./managers/commandManager";
import { EditorManager } from "./managers/editorManager";

/** Main plugin class for Sandbox Note functionality. */
export default class SandboxNotePlugin extends Plugin {
	settings: SandboxNotePluginSettings = DEFAULT_SETTINGS;
	logger!: DirectLogger;

	// Managers
	contentManager!: ContentManager;
	saveManager!: SaveManager;
	uiManager!: UIManager;
	commandManager!: CommandManager;
	editorManager!: EditorManager;

	/** Initialize plugin on load. */
	async onload() {
		await this.loadSettings();
		this.initializeLogger();
		this.initializeManagers();
		this.setupSettingsTab();
		this.editorManager.setupEditorExtension();
		this.setupWorkspaceEventHandlers();
		this.registerViewType();
		this.uiManager.setupUserInterface();
		this.commandManager.setupSaveCommandMonkeyPatch();
	}

	/** Initialize all manager instances */
	private initializeManagers() {
		this.contentManager = new ContentManager(this, this.logger);
		this.saveManager = new SaveManager(this, this.logger);
		this.uiManager = new UIManager(this);
		this.commandManager = new CommandManager(this);
		this.editorManager = new EditorManager(this);
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
		this.saveManager.handleActiveLeafChange();

		// Connect the editor plugin to the new active view
		if (activeView instanceof SandboxNoteView) {
			this.editorManager.connectEditorPluginToView(activeView);
		}
	}

	/** Register custom view type. */
	private registerViewType() {
		this.registerView(VIEW_TYPE, (leaf) => new SandboxNoteView(leaf, this));
	}

	/** Update shared content and sync across all views. */
	updateNoteContent(content: string, sourceView: SandboxNoteView) {
		this.contentManager.updateNoteContent(content, sourceView);
	}

	/** Cleanup on plugin unload. */
	async onunload() {
		this.logger.debug("Sandbox Note plugin unloaded");
		// Save note content on unload if enabled
		const activeView =
			this.app.workspace.getActiveViewOfType(SandboxNoteView);
		if (
			this.settings.enableSaveNoteContent &&
			activeView instanceof SandboxNoteView
		) {
			// Save synchronously (fire and forget)
			await this.saveManager.saveNoteContentToFile(activeView);
		}
		// The `around` utility automatically registers a cleanup function
		// that reverts the monkey patch when the plugin is unloaded.
		// No manual unpatching is required here.
	}

	/** Create and activate new Sandbox Note view. */
	async activateView() {
		const leaf = await activateView(this.app, {
			type: VIEW_TYPE,
			active: true,
		});

		return leaf;
	}

	/** Initialize logger with current settings. */
	initializeLogger(): void {
		this.logger = new DirectLogger({
			level: this.settings.logLevel,
			name: "SandboxNotePlugin",
		});
		this.logger.debug("debug mode enabled");
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
		await this.saveData(this.settings);
		// Refresh all view titles when settings change
		this.contentManager.refreshAllViewTitles();
	}
}
