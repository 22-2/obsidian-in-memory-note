import { debounce } from "obsidian";
import type SandboxNotePlugin from "src/main";
import { SandboxNoteView } from "src/views/SandboxNoteView";
import log from "loglevel";

/** Manages Obsidian workspace event handling */
export class WorkspaceEventManager {
	private plugin: SandboxNotePlugin;
	private debouncedSetupSandboxViews: () => void;

	constructor(plugin: SandboxNotePlugin) {
		this.plugin = plugin;
		this.debouncedSetupSandboxViews = debounce(
			this.setupSandboxViews.bind(this),
			50
		);
	}

	/** Set up all workspace event listeners */
	public setupEventHandlers(): void {
		this.plugin.app.workspace.onLayoutReady(() => this.setupSandboxViews());

		this.plugin.registerEvent(
			this.plugin.app.workspace.on(
				"active-leaf-change",
				this.handleActiveLeafChange.bind(this)
			)
		);
		this.plugin.registerEvent(
			this.plugin.app.workspace.on(
				"layout-change",
				this.debouncedSetupSandboxViews
			)
		);
	}

	/** Connects the editor plugin to any existing sandbox views on layout ready or change. */
	private setupSandboxViews(): void {
		log.debug("Workspace layout ready/changed, setting up sandbox views.");
		this.plugin.editorSyncManager.activeViews.forEach((view) => {
			log.debug(`Connecting to existing view: ${view.getViewType()}`);
			this.plugin.editorPluginConnector.connectEditorPluginToView(view);
		});
	}
	/** Handle active leaf changes to connect the editor plugin and trigger auto-save. */
	private async handleActiveLeafChange() {
		// Auto-save when switching tabs if enabled and there are unsaved changes
		if (
			this.plugin.settings.enableAutoSave &&
			this.plugin.editorSyncManager.hasUnsavedChanges
		) {
			// Get any active SandboxNoteView instance for saving
			const anySandboxView = this.plugin.editorSyncManager.activeViews
				.values()
				.next().value;

			if (anySandboxView) {
				log.debug(
					"Active leaf changed, triggering auto-save for Sandbox Note."
				);

				// Save immediately without waiting for debounce
				await this.plugin.saveManager.saveNoteContentToFile(
					anySandboxView
				);

				// Note: saveNoteContentToFile cancels any running debounce timer
				this.plugin.editorSyncManager.refreshAllViewTitles();
			}
		}

		// Only proceed if the new active view is a SandboxNoteView
		const activeView =
			this.plugin.app.workspace.getActiveViewOfType(SandboxNoteView);
		if (!(activeView instanceof SandboxNoteView)) {
			return;
		}

		// Connect the editor plugin to the new active view
		this.plugin.editorPluginConnector.connectEditorPluginToView(activeView);
	}
}
