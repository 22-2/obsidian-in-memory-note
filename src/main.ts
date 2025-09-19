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

/**
 * The main plugin class for In-Memory Note.
 * It handles the plugin's lifecycle, settings, and commands.
 */
export default class InMemoryNotePlugin extends Plugin {
	settings: InMemoryNotePluginSettings = DEFAULT_SETTINGS;
	logger!: DirectLogger;
	noteContent = "";
	activeViews: Set<InMemoryNoteView> = new Set();

	/**
	 * This method is called when the plugin is loaded.
	 */
	async onload() {
		await this.loadSettings();
		this.addSettingTab(new InMemoryNoteSettingTab(this));
		this.initializeLogger();

		this.registerView(
			VIEW_TYPE,
			(leaf) => new InMemoryNoteView(leaf, this)
		);

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
	 * Updates the shared note content and propagates the change to other views.
	 * @param content The new content of the note.
	 * @param sourceView The view instance that initiated the change.
	 */
	updateNoteContent(content: string, sourceView: InMemoryNoteView) {
		this.noteContent = content;
		for (const view of this.activeViews) {
			if (view !== sourceView) {
				view.setContent(content);
			}
		}
	}

	/**
	 * This method is called when the plugin is unloaded.
	 */
	onunload() {
		this.logger.debug("Plugin unloaded");
	}

	/**
	 * Activates and opens the In-Memory Note view.
	 * If a view is already present, it reveals and focuses it.
	 * Otherwise, it opens the view in a new tab.
	 */
	async activateView() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
		if (leaves.length > 0) {
			this.app.workspace.revealLeaf(leaves[0]);
			return;
		}

		return activateView(this.app, {
			type: VIEW_TYPE,
			active: true,
		});
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
