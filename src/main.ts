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
	private currentSavedNoteFile: string | null = null;

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
	 */
	private handleActiveLeafChange() {
		const activeView = this.app.workspace.getActiveViewOfType(InMemoryNoteView);

		// Auto-save content from previous view if enabled
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
		const editorPlugin = view.inlineEditor.inlineView.editor.cm.plugin(watchEditorPlugin);
		if (editorPlugin) {
			editorPlugin.connectToPlugin(this, view);
		}
	}

	/**
	 * Registers the custom view type with Obsidian.
	 */
	private registerViewType() {
		this.registerView(VIEW_TYPE, (leaf) => new InMemoryNoteView(leaf, this));
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
	 * Automatically saves note content to a file when switching away from a view.
	 * Only saves non-empty content and maintains a single saved note file.
	 * @param view The view instance to save content from.
	 */
	private async saveNoteContentToFile(view: InMemoryNoteView) {
		try {
			const content = view.inlineEditor.getContent();
			
			// Skip saving if content is empty
			if (!content || content.trim() === "") {
				return;
			}

			// Clean up previous saved note to maintain only one file
			await this.cleanupPreviousSavedNote();

			// Create new timestamped note file
			const fileName = `in-memory-note-${Date.now()}.md`;
			const file = await this.app.vault.create(fileName, content);
			this.currentSavedNoteFile = file.path;
			
			this.logger.debug(`Auto-saved note content to: ${file.path}`);
		} catch (error) {
			this.logger.error(`Failed to auto-save note content: ${error}`);
		}
	}

	/**
	 * Removes the previously saved note file if it exists.
	 */
	private async cleanupPreviousSavedNote() {
		if (!this.currentSavedNoteFile) {
			return;
		}

		const existingFile = this.app.vault.getAbstractFileByPath(this.currentSavedNoteFile);
		if (existingFile) {
			await this.app.vault.delete(existingFile);
			this.logger.debug(`Cleaned up previous saved note: ${this.currentSavedNoteFile}`);
		}
		
		this.currentSavedNoteFile = null;
	}

	/**
	 * Cleanup when the plugin is unloaded.
	 */
	onunload() {
		this.logger.debug("In-Memory Note plugin unloaded");
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
	}
}
