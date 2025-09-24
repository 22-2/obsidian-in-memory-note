import { debounce } from "obsidian";
import { SandboxNoteView } from "src/views/SandboxNoteView";
import log from "loglevel";
import type { App, Workspace } from "obsidian";
import type { EventEmitter } from "src/utils/EventEmitter";
import type { AppEvents } from "src/events/AppEvents";
import type { EditorSyncManager } from "./EditorSyncManager";
import type { EditorPluginConnector } from "./EditorPluginConnector";
import type { PluginSettings } from "src/settings";
import type { Manager } from "./Manager";
import { AbstractNoteView } from "src/views/internal/AbstractNoteView";

/** Manages Obsidian workspace event handling */
export class WorkspaceEventManager implements Manager {
	private app: App;
	private workspace: Workspace;
	private emitter: EventEmitter<AppEvents>;
	private editorSyncManager: EditorSyncManager;
	private editorPluginConnector: EditorPluginConnector;
	private settings: PluginSettings;
	private debouncedSetupSandboxViews: () => void;

	constructor(
		app: App,
		emitter: EventEmitter<AppEvents>,
		editorSyncManager: EditorSyncManager,
		editorPluginConnector: EditorPluginConnector,
		settings: PluginSettings
	) {
		this.app = app;
		this.workspace = app.workspace;
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
		const activeView = this.workspace.getActiveViewOfType(SandboxNoteView);
		// @ts-ignore - Accessing a private API to manage the active editor.
		const workspace = this.app.workspace;

		// If the active view is our sandbox view, set its virtual editor as active.
		if (activeView instanceof AbstractNoteView && activeView.editor) {
			log.debug(
				`Setting activeEditor to Sandbox view's editor in leaf: ${this.workspace.activeLeaf?.id}`
			);
			workspace._activeEditor = activeView.wrapper.virtualEditor;
		}
		// If the active editor was ours, but the view is no longer a sandbox view...
		else if (
			// @ts-expect-error
			workspace._activeEditor?.leaf?.__FAKE_LEAF__ &&
			!(activeView instanceof AbstractNoteView)
		) {
			// ...clear it to avoid side effects on regular notes.
			log.debug(
				"Active view is not a Sandbox view, clearing activeEditor."
			);
			workspace._activeEditor = null;
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
		const activeView = this.workspace.getActiveViewOfType(SandboxNoteView);

		// Only proceed if the new active view is a SandboxNoteView.
		if (activeView instanceof SandboxNoteView) {
			this.editorPluginConnector.connectEditorPluginToView(activeView);
		}
	}
}
