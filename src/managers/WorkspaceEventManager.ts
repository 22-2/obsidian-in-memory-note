import log from "loglevel";
import type { App, Workspace } from "obsidian";
import { debounce } from "obsidian";
import type { AppEvents } from "src/events/AppEvents";
import type SandboxNotePlugin from "src/main";
import type { PluginSettings } from "src/settings";
import type { EventEmitter } from "src/utils/EventEmitter";
import { SandboxNoteView } from "src/views/SandboxNoteView";
import type { EditorPluginConnector } from "./EditorPluginConnector";
import type { EditorSyncManager } from "./EditorSyncManager";
import type { Manager } from "./Manager";

/** Manages Obsidian workspace event handling */
export class WorkspaceEventManager implements Manager {
	private plugin: SandboxNotePlugin;
	private app: App;
	private workspace: Workspace;
	private emitter: EventEmitter<AppEvents>;
	private editorSyncManager: EditorSyncManager;
	private editorPluginConnector: EditorPluginConnector;
	private settings: PluginSettings;
	private debouncedSetupSandboxViews: () => void;

	constructor(
		plugin: SandboxNotePlugin,
		emitter: EventEmitter<AppEvents>,
		editorSyncManager: EditorSyncManager,
		editorPluginConnector: EditorPluginConnector,
		settings: PluginSettings
	) {
		this.plugin = plugin;
		this.app = plugin.app;
		this.workspace = plugin.app.workspace;
		this.emitter = emitter;
		this.editorSyncManager = editorSyncManager;
		this.editorPluginConnector = editorPluginConnector;
		this.settings = settings;
		this.debouncedSetupSandboxViews = debounce(
			this.setupSandboxViews.bind(this),
			50
		);
	}

	/** Set up all workspace event listeners */
	public load(): void {
		this.workspace.onLayoutReady(() => this.setupSandboxViews());
		this.workspace.on("active-leaf-change", this.handleActiveLeafChange);
		this.workspace.on("layout-change", this.debouncedSetupSandboxViews);
	}

	public unload(): void {
		this.workspace.off("active-leaf-change", this.handleActiveLeafChange);
		this.workspace.off("layout-change", this.debouncedSetupSandboxViews);
	}

	/** Connects the editor plugin to any existing sandbox views on layout ready or change. */
	private setupSandboxViews(): void {
		log.debug("Workspace layout ready/changed, setting up sandbox views.");
		this.editorSyncManager.activeViews.forEach((view) => {
			log.debug(`Connecting to existing view: ${view.getViewType()}`);
			this.editorPluginConnector.connectEditorPluginToView(view);
			this.syncActiveEditorState();
		});
	}

	/**
	 * Handles active leaf changes to sync editor state, auto-save, and connect plugins.
	 */
	private handleActiveLeafChange = () => {
		log.debug(`Active leaf changed to: ${this.workspace.activeLeaf?.id}`);

		this.syncActiveEditorState();
		this.triggerAutoSave();
		this.connectEditorPluginToActiveView();
	};

	/**
	 * Syncs Obsidian's internal active editor state with our virtual editor.
	 * This ensures that commands and other editor features work correctly.
	 */
	private syncActiveEditorState(): void {
		const activeView = this.plugin.getActiveSandboxNoteView();
		if (activeView instanceof SandboxNoteView) {
			activeView.syncActiveEditorState();
		}
	}

	/**
	 * Triggers auto-save on leaf change if the feature is enabled
	 * and there are unsaved changes.
	 */
	private triggerAutoSave(): void {
		if (
			!this.settings.enableAutoSave ||
			!this.editorSyncManager.hasUnsavedChanges
		) {
			return;
		}

		// Get any active SandboxNoteView instance to perform the save.
		const anySandboxView = this.editorSyncManager.activeViews
			.values()
			.next().value;

		if (anySandboxView) {
			log.debug(
				"Active leaf changed, triggering auto-save for Sandbox Note."
			);

			this.emitter.emit("save-requested", {
				view: anySandboxView,
			});

			this.editorSyncManager.refreshAllViewTitles();
		}
	}

	/**
	 * Connects the editor plugin to the newly active sandbox view, if it is one.
	 */
	private connectEditorPluginToActiveView(): void {
		const activeView = this.plugin.getActiveSandboxNoteView();

		if (activeView) {
			this.editorPluginConnector.connectEditorPluginToView(activeView);
		}
	}
}
