import { Plugin } from "obsidian";
import {
	type InMemoryNotePluginSettings,
	InMemoryNoteSettingTab,
} from "./settings";
import {
	DEFAULT_SETTINGS,
	IN_MEMORY_NOTE_ICON,
	VIEW_TYPE,
} from "./utils/constants";
import { DirectLogger } from "./utils/logging";
import { activateView } from "./utils/obsidian";
import { InMemoryNoteView } from "./view";
import { watchEditorPlugin } from "./watchEditorPlugin";
import { around } from "monkey-around";

/** Main plugin class for In-Memory Note functionality. */
export default class InMemoryNotePlugin extends Plugin {
	settings: InMemoryNotePluginSettings = DEFAULT_SETTINGS;
	logger!: DirectLogger;

	/** Shared content across all views */
	sharedNoteContent = "";

	/** Currently active views */
	activeViews: Set<InMemoryNoteView> = new Set();

	/** CodeMirror plugin for watching changes */
	watchEditorPlugin = watchEditorPlugin;

	private previousActiveView: InMemoryNoteView | null = null;



	/** Initialize plugin on load. */
	async onload() {
		await this.loadSettings();
		this.initializeLogger();
		this.setupSettingsTab();
		this.setupEditorExtension();
		this.setupWorkspaceEventHandlers();
		this.registerViewType();
		this.setupUserInterface();
		this.setupSaveCommandMonkeyPatch(); // Call the new setup method here
	}

	/** Setup plugin settings tab. */
	private setupSettingsTab() {
		this.addSettingTab(new InMemoryNoteSettingTab(this));
	}

	/** Register editor extension for watching changes. */
	private setupEditorExtension() {
		this.registerEditorExtension(watchEditorPlugin);
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
			this.app.workspace.getActiveViewOfType(InMemoryNoteView);

		// Auto-save content from previous view when save setting is enabled
		if (this.settings.enableSaveNoteContent && this.previousActiveView) {
			this.saveNoteContentToFile(this.previousActiveView);
		}

		// Connect the editor plugin to the new active view
		if (activeView instanceof InMemoryNoteView) {
			this.connectEditorPluginToView(activeView);
		}

		this.previousActiveView = activeView;
	}

	/** Connect watch editor plugin to view. */
	private connectEditorPluginToView(view: InMemoryNoteView) {
		const editorPlugin =
			view.inlineEditor.inlineView.editor.cm.plugin(watchEditorPlugin);
		if (editorPlugin) {
			editorPlugin.connectToPlugin(this, view);
		}
	}

	/** Register custom view type. */
	private registerViewType() {
		this.registerView(
			VIEW_TYPE,
			(leaf) => new InMemoryNoteView(leaf, this)
		);
	}

	/** Setup UI elements (ribbon icon and commands). */
	private setupUserInterface() {
		this.addRibbonIcon(IN_MEMORY_NOTE_ICON, "Open in-memory note", () => {
			this.activateView();
		});

		this.addCommand({
			id: "open-in-memory-note-view",
			name: "Open in-memory note",
			callback: () => {
				this.activateView();
			},
		});
	}

	/** Setup monkey patch for save command to handle in-memory notes. */
	private setupSaveCommandMonkeyPatch() {
		const saveCommandDefinition =
			this.app.commands?.commands?.["editor:save-file"];

		if (saveCommandDefinition?.checkCallback) {

			// Apply the monkey-patch using 'around'
			this.register(
				around(saveCommandDefinition, {
					checkCallback: (orig) => {
						// Return a new checkCallback function that acts as our interceptor
						return (checking: boolean) => {
							if (checking) {
								// If Obsidian is just checking if the command is available,
								// we should always allow it, or delegate to the original for more complex checks.
								// For our purpose, we want the save command to always appear if Obsidian normally allows it.
								return orig?.call(this, checking) ?? true;
							}

							// When the command is actually executed (checking is false)
							const activeView =
								this.app.workspace.getActiveViewOfType(
									InMemoryNoteView
								);

							if (
								activeView &&
								this.settings.enableSaveNoteContent
							) {
								// If it's an InMemoryNoteView and saving is enabled,
								// execute our custom save logic.
								this.saveNoteContentToFile(activeView);
								return true; // Indicate that the command was handled.
							} else {
								// Otherwise, call the original save command's logic.
								// It's important to call 'orig' with 'this' context if it depends on it.
								return orig?.call(this, checking);
							}
						};
					},
				})
			);
		}
	}

	/** Update shared content and sync across all views. */
	updateNoteContent(content: string, sourceView: InMemoryNoteView) {
		this.sharedNoteContent = content;

		// Synchronize content to all other active views
		for (const view of this.activeViews) {
			if (view !== sourceView) {
				view.setContent(content);
			}
		}
	}

	/** Save note content to data.json using Obsidian API. */
	private async saveNoteContentToFile(view: InMemoryNoteView) {
		try {
			const content = view.inlineEditor.getContent();

			// Skip saving if content is empty
			if (!content || content.trim() === "") {
				this.logger.debug(
					"Skipping save: In-memory note content is empty."
				);
				return;
			}

			// Save content to data.json using Obsidian API
			const dataToSave = {
				...this.settings,
				noteContent: content,
				lastSaved: new Date().toISOString()
			};

			await this.saveData(dataToSave);

			// Mark the view as saved since content was persisted
			view.markAsSaved();

			this.logger.debug("Auto-saved note content to data.json using Obsidian API");
		} catch (error) {
			this.logger.error(`Failed to auto-save note content: ${error}`);
		}
	}



	/** Cleanup on plugin unload. */
	onunload() {
		this.logger.debug("In-Memory Note plugin unloaded");
		// The `around` utility automatically registers a cleanup function
		// that reverts the monkey patch when the plugin is unloaded.
		// No manual unpatching is required here.
	}

	/** Create and activate new In-Memory Note view. */
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
			name: "InMemoryNotePlugin",
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
		this.refreshAllViewTitles();
	}

	/** Refresh all view titles when settings change. */
	private refreshAllViewTitles() {
		for (const view of this.activeViews) {
			view.leaf.updateHeader();
		}
	}
}
