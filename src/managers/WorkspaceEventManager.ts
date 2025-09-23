import { debounce } from "obsidian";
import { SandboxNoteView } from "src/views/SandboxNoteView";
import log from "loglevel";
import type { App, Workspace } from "obsidian";
import type { EventEmitter } from "src/utils/EventEmitter";
import type { AppEvents } from "src/events/AppEvents";
import type { EditorSyncManager } from "./EditorSyncManager";
import type { EditorPluginConnector } from "./EditorPluginConnector";
import type { PluginSettings } from "src/settings";

/** Manages Obsidian workspace event handling */
export class WorkspaceEventManager {
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
	public setupEventHandlers(): void {
		this.workspace.onLayoutReady(() => this.setupSandboxViews());

		this.workspace.on(
			"active-leaf-change",
			this.handleActiveLeafChange.bind(this)
		);
		this.workspace.on("layout-change", this.debouncedSetupSandboxViews);
	}

	/** Connects the editor plugin to any existing sandbox views on layout ready or change. */
	private setupSandboxViews(): void {
		log.debug("Workspace layout ready/changed, setting up sandbox views.");
		this.editorSyncManager.activeViews.forEach((view) => {
			log.debug(`Connecting to existing view: ${view.getViewType()}`);
			this.editorPluginConnector.connectEditorPluginToView(view);
		});
	}
	/** Handle active leaf changes to connect the editor plugin and trigger auto-save. */
	private async handleActiveLeafChange() {
		// Auto-save when switching tabs if enabled and there are unsaved changes
		if (
			this.settings.enableAutoSave &&
			this.editorSyncManager.hasUnsavedChanges
		) {
			// Get any active SandboxNoteView instance for saving
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

				// Note: saveNoteContentToFile cancels any running debounce timer
				this.editorSyncManager.refreshAllViewTitles();
			}
		}

		// Only proceed if the new active view is a SandboxNoteView
		const activeView = this.workspace.getActiveViewOfType(SandboxNoteView);
		if (!(activeView instanceof SandboxNoteView)) {
			return;
		}

		// Connect the editor plugin to the new active view
		this.editorPluginConnector.connectEditorPluginToView(activeView);
	}
}
