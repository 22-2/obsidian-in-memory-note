import { MarkdownView, Notice, Plugin } from "obsidian";
import {
	type SandboxNotePluginSettings,
	SandboxNoteSettingTab,
} from "./settings";
import {
	DEFAULT_SETTINGS,
	VIEW_TYPE_SANDBOX,
	VIEW_TYPE_IN_MEMORY,
} from "./utils/constants";
import { DirectLogger, Logger } from "./utils/logging";
import { activateView } from "./utils/obsidian";
import { SandboxNoteView } from "./views/SandboxNoteView";
import { InMemoryNoteView } from "./views/InMemoryNoteView";
import { AbstractNoteView } from "./views/AbstractNoteView";
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
		if (!this.checkCompatibility()) {
			new Notice(
				"Sandbox Note plugin: Incompatible with this version of Obsidian. The plugin has been disabled."
			);
			return;
		}

		await this.loadSettings();
		this.initializeLogger();
		this.initializeManagers();
		this.contentManager.sharedNoteContent = this.settings.noteContent ?? "";
		this.setupSettingsTab();
		this.editorManager.setupEditorExtension();
		this.setupWorkspaceEventHandlers();
		this.registerViewType();
		this.uiManager.setupUserInterface();
		this.commandManager.updateSaveCommandMonkeyPatch();
		this.app.workspace.onLayoutReady(() => this.onLayoutReady());
	}

	/** Fires once the workspace is ready. */
	private onLayoutReady(): void {
		this.logger.debug("Workspace layout ready.");
		// Connect to any existing sandbox views that were restored on startup
		this.app.workspace
			.getLeavesOfType(VIEW_TYPE_SANDBOX)
			.forEach((leaf) => {
				if (leaf.view instanceof SandboxNoteView) {
					this.logger.debug(
						`Connecting to existing view on layout ready: ${leaf.view.getViewType()}`
					);
					this.editorManager.connectEditorPluginToView(leaf.view);
				}
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
			const dummyEl = document.createElement("div");
			// @ts-ignore - We are intentionally accessing a private constructor.
			const view = new MarkdownView({
				containerEl: dummyEl,
				app: this.app,
				workspace: this.app.workspace,
				history: { backHistory: [], forwardHistory: [] },
			} as any);

			view.unload();
			dummyEl.remove();

			return true;
		} catch (error) {
			console.error(
				"Sandbox Note plugin: Compatibility check failed. This is likely due to an Obsidian update.",
				error
			);
			return false;
		}
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
		this.contentManager.updateNoteContent(content, sourceView);
	}

	/** Cleanup on plugin unload. */
	async onunload() {
		this.logger.debug("Sandbox Note plugin unloaded");
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
		this.logger = Logger.getSubLogger({
			name: "SandboxNotePlugin",
		});
		this.logger.updateLoggingState(this.settings.logLevel);
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
		const settingsToSave = {
			...this.settings,
			noteContent: this.contentManager.sharedNoteContent,
		};
		await this.saveData(settingsToSave);
		// Refresh all view titles when settings change
		this.contentManager.refreshAllViewTitles();
	}
}
