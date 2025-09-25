import log from "loglevel";
import type { App, Workspace } from "obsidian";
import { debounce } from "obsidian";
import type { AppEvents } from "src/events/AppEvents";
import type SandboxNotePlugin from "src/main";
import type { PluginSettings } from "src/settings";
import { VIEW_TYPE_HOT_SANDBOX } from "src/utils/constants";
import type { EventEmitter } from "src/utils/EventEmitter";
import { AbstractNoteView } from "src/views/internal/AbstractNoteView";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";
import type { EditorPluginConnector } from "./EditorPluginConnector";
import type { EditorSyncManager } from "./EditorSyncManager";
import type { Manager } from "./Manager";
import type { SaveManager } from "./SaveManager";

/** Manages Obsidian workspace event handling */
export class ObsidianEventManager implements Manager {
	private plugin: SandboxNotePlugin;
	private app: App;
	private workspace: Workspace;
	private emitter: EventEmitter<AppEvents>;
	private editorSyncManager: EditorSyncManager;
	private editorPluginConnector: EditorPluginConnector;
	private settings: PluginSettings;
	private saveManager: SaveManager;
	private debouncedSetupSandboxViews: () => void;

	constructor(
		plugin: SandboxNotePlugin,
		emitter: EventEmitter<AppEvents>,
		editorSyncManager: EditorSyncManager,
		editorPluginConnector: EditorPluginConnector,
		settings: PluginSettings,
		saveManager: SaveManager
	) {
		this.plugin = plugin;
		this.app = plugin.app;
		this.workspace = plugin.app.workspace;
		this.emitter = emitter;
		this.editorSyncManager = editorSyncManager;
		this.editorPluginConnector = editorPluginConnector;
		this.settings = settings;
		this.saveManager = saveManager;
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
		this.workspace
			.getLeavesOfType(VIEW_TYPE_HOT_SANDBOX)
			.forEach((leaf) => {
				const view = leaf.view;
				if (view instanceof HotSandboxNoteView) {
					log.debug(
						`Connecting to existing view: ${view.getViewType()}`
					);
					this.editorPluginConnector.connectEditorPluginToView(view);
				}
			});
		this.syncActiveEditorState();
	}

	/**
	 * Handles active leaf changes to sync editor state, auto-save, and connect plugins.
	 */
	private handleActiveLeafChange = () => {
		log.debug(`Active leaf changed to: ${this.workspace.activeLeaf?.id}`);

		this.syncActiveEditorState();
		this.connectEditorPluginToActiveView();
	};

	/**
	 * Syncs Obsidian's internal active editor state with our virtual editor.
	 * This ensures that commands and other editor features work correctly.
	 */
	private syncActiveEditorState(): void {
		const activeView = this.plugin.getActiveAbstractNoteView();
		if (activeView instanceof AbstractNoteView) {
			activeView.syncActiveEditorState();
		}
	}

	/**
	 * Connects the editor plugin to the newly active sandbox view, if it is one.
	 */
	private connectEditorPluginToActiveView(): void {
		const activeView = this.plugin.getActiveAbstractNoteView();

		if (activeView) {
			this.editorPluginConnector.connectEditorPluginToView(activeView);
		}
	}
}
