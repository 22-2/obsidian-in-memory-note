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

	/** Handle active leaf changes to connect the editor plugin. */
	private handleActiveLeafChange() {
		const activeView =
			this.plugin.app.workspace.getActiveViewOfType(SandboxNoteView);

		// Connect the editor plugin to the new active view
		if (activeView instanceof SandboxNoteView) {
			this.plugin.editorPluginConnector.connectEditorPluginToView(
				activeView
			);
		}
	}
}
