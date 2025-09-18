import { Plugin, Workspace, WorkspaceLeaf } from "obsidian";
import { removeClickHandlers, registerClickHandlers } from "./click-handler";
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
import { activateView, getAllWorkspaceWindows } from "./utils/obsidian";
import { InMemoryNoteView } from "./view";

/**
 * The main plugin class for In-Memory Note.
 * It handles the plugin's lifecycle, settings, and commands.
 */
export default class InMemoryNotePlugin extends Plugin {
	settings: InMemoryNotePluginSettings = DEFAULT_SETTINGS;
	logger!: DirectLogger;

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

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", this.handleRegister)
		);
	}

	handleRegister = (leaf: WorkspaceLeaf | null) => {
		if (leaf?.view.getViewType() === VIEW_TYPE) {
			registerClickHandlers(this, leaf.containerEl);
		}
	};

	/**
	 * This method is called when the plugin is unloaded.
	 */
	onunload() {
		this.logger.debug("Plugin unloaded");
	}

	/**
	 * Activates and opens the In-Memory Note view in a new tab.
	 */
	async activateView() {
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
