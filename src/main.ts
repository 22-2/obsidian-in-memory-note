import { Plugin, TFile } from "obsidian";
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

/**
 * Main plugin class for In-Memory Note functionality.
 * Manages plugin lifecycle, settings, view synchronization, and commands.
 */
export default class InMemoryNotePlugin extends Plugin {
	settings: InMemoryNotePluginSettings = DEFAULT_SETTINGS;
	logger!: DirectLogger;

	/** Shared content across all in-memory note views */
	sharedNoteContent = "";

	/** Set of currently active in-memory note views */
	activeViews: Set<InMemoryNoteView> = new Set();

	/** CodeMirror plugin for watching editor changes */
	watchEditorPlugin = watchEditorPlugin;

	private previousActiveView: InMemoryNoteView | null = null;

	// Store the original checkCallback for 'editor:save-file'
	private originalSaveCheckCallback:
		| ((checking: boolean) => boolean | void)
		| null = null;

	/**
	 * Initializes the plugin when loaded.
	 */
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

	/**
	 * Sets up the plugin settings tab.
	 */
	private setupSettingsTab() {
		this.addSettingTab(new InMemoryNoteSettingTab(this));
	}

	/**
	 * Registers the editor extension for watching changes.
	 */
	private setupEditorExtension() {
		this.registerEditorExtension(watchEditorPlugin);
	}

	/**
	 * Sets up workspace event handlers for view management.
	 */
	private setupWorkspaceEventHandlers() {
		this.app.workspace.on("active-leaf-change", () => {
			this.handleActiveLeafChange();
		});
	}

	/**
	 * Handles active leaf changes to manage view synchronization and content saving.
	 * Always saves content when switching away from an in-memory note view if save setting is enabled.
	 */
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

	/**
	 * Connects the watch editor plugin to a specific view.
	 */
	private connectEditorPluginToView(view: InMemoryNoteView) {
		const editorPlugin =
			view.inlineEditor.inlineView.editor.cm.plugin(watchEditorPlugin);
		if (editorPlugin) {
			editorPlugin.connectToPlugin(this, view);
		}
	}

	/**
	 * Registers the custom view type with Obsidian.
	 */
	private registerViewType() {
		this.registerView(
			VIEW_TYPE,
			(leaf) => new InMemoryNoteView(leaf, this)
		);
	}

	/**
	 * Sets up the user interface elements (ribbon icon and commands).
	 */
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

	/**
	 * Sets up the monkey patch for the 'editor:save-file' command.
	 * This ensures that when the command is triggered:
	 * 1. If the active view is an InMemoryNoteView and `enableSaveNoteContent` is true,
	 *    it will save the in-memory note content.
	 * 2. Otherwise, it will defer to the original save command behavior.
	 */
	private setupSaveCommandMonkeyPatch() {
		const saveCommandDefinition =
			this.app.commands?.commands?.["editor:save-file"];

		if (saveCommandDefinition?.checkCallback) {
			// Store the original checkCallback to be able to call it later
			this.originalSaveCheckCallback =
				saveCommandDefinition.checkCallback;

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

	/**
	 * Updates the shared note content and synchronizes it across all active views.
	 * @param content The new content to propagate.
	 * @param sourceView The view that initiated the content change.
	 */
	updateNoteContent(content: string, sourceView: InMemoryNoteView) {
		this.sharedNoteContent = content;

		// Synchronize content to all other active views
		for (const view of this.activeViews) {
			if (view !== sourceView) {
				view.setContent(content);
			}
		}
	}

	/**
	 * Saves note content using Obsidian API to data.json without file deletion.
	 * Uses plugin's saveData method to safely persist content.
	 * @param view The view instance to save content from.
	 */
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



	/**
	 * Cleanup when the plugin is unloaded.
	 */
	onunload() {
		this.logger.debug("In-Memory Note plugin unloaded");
		// The `around` utility automatically registers a cleanup function
		// that reverts the monkey patch when the plugin is unloaded.
		// No manual unpatching is required here.
	}

	/**
	 * Creates and activates a new In-Memory Note view.
	 * Multiple views can be open simultaneously and will stay synchronized.
	 * @returns The newly created leaf containing the view.
	 */
	async activateView() {
		const leaf = await activateView(this.app, {
			type: VIEW_TYPE,
			active: true,
		});

		return leaf;
	}

	/**
	 * Initializes the logger based on the current settings.
	 */
	initializeLogger(): void {
		this.logger = new DirectLogger({
			level: this.settings.logLevel,
			name: "InMemoryNotePlugin",
		});
		this.logger.debug("debug mode enabled");
	}

	/**
	 * Loads plugin settings from storage.
	 */
	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	/**
	 * Saves the current plugin settings to storage.
	 */
	async saveSettings() {
		await this.saveData(this.settings);
		// Refresh all view titles when settings change
		this.refreshAllViewTitles();
	}

	/**
	 * Refreshes the titles of all active views to reflect current settings.
	 * This is called when the save setting is toggled.
	 */
	private refreshAllViewTitles() {
		for (const view of this.activeViews) {
			view.leaf.updateHeader();
		}
	}
}
