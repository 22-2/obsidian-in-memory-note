import log from "loglevel";
import { Plugin } from "obsidian";
import type { AppEvents } from "./events/AppEvents";
import { AppOrchestrator } from "./managers/AppOrchestrator";
import { SandboxNoteSettingTab } from "./settings";
import {
	DEBUG_MODE,
	HOT_SANDBOX_NOTE_ICON,
	VIEW_TYPE_HOT_SANDBOX,
} from "./utils/constants";
import { EventEmitter } from "./utils/EventEmitter";
import "./utils/setup-logger";
import { overwriteLogLevel } from "./utils/setup-logger";
import { HotSandboxNoteView } from "./views/HotSandboxNoteView";
import { convertToFileAndClear } from "./views/internal/utils";

const logger = log.getLogger("SandboxNotePlugin");

/** Main plugin class for Sandbox Note functionality. */
export default class SandboxNotePlugin extends Plugin {
	// Core components
	orchestrator!: AppOrchestrator;
	emitter!: EventEmitter<AppEvents>;

	/** Initialize plugin on load. */
	async onload() {
		if (!DEBUG_MODE) {
			overwriteLogLevel();
		} else {
			logger.debug("BUILT_AT", process.env.BUILT_AT);
		}

		this.initializeCoreComponents();

		// Load all managers and data via the orchestrator
		await this.orchestrator.load();

		this.applyLogger();
		this.setupSettingsTab();
		this.setupCommandsAndRibbons();

		logger.debug("Sandbox Note plugin loaded");
	}

	/** Initialize the core components of the plugin. */
	private initializeCoreComponents() {
		this.emitter = new EventEmitter<AppEvents>();
		this.orchestrator = new AppOrchestrator(this, this.emitter);
	}

	/** Setup plugin settings tab. */
	private setupSettingsTab() {
		this.addSettingTab(new SandboxNoteSettingTab(this));
	}

	private setupCommandsAndRibbons() {
		// Command to open the new hot sandbox note
		this.addCommand({
			id: "open-hot-sandbox-note-view",
			name: "Open new hot sandbox note",
			icon: HOT_SANDBOX_NOTE_ICON,
			callback: () => {
				this.activateNewHotSandboxView();
			},
		});

		this.addCommand({
			id: "convert-to-file",
			name: "Convert to file",
			icon: "file-pen-line",
			checkCallback: (checking) => {
				const view = this.getActiveView();
				if (view) {
					if (!checking) {
						convertToFileAndClear(view);
					}
					return true;
				}
				return false;
			},
		});

		// Ribbon icon to open the hot sandbox note
		this.addRibbonIcon(
			HOT_SANDBOX_NOTE_ICON,
			"Open new hot sandbox note",
			() => {
				this.activateNewHotSandboxView();
			}
		);
	}

	/** Cleanup on plugin unload. */
	async onunload() {
		this.orchestrator.unload();
		logger.debug("Sandbox Note plugin unloaded");
	}

	/**
	 * Activates a new hot sandbox view.
	 * This is delegated to the ViewFactory managed by the orchestrator.
	 */
	async activateNewHotSandboxView() {
		return this.orchestrator.viewFactory.activateNewHotSandboxView();
	}

	/** Initialize logger with current settings. */
	applyLogger(): void {
		const settings = this.orchestrator?.getSettings();
		if (settings) {
			settings.enableLogger
				? logger.setLevel("debug")
				: logger.setLevel("warn");
		} else {
			logger.setLevel("warn");
		}
		logger.debug("Logger initialized");
	}

	/** Returns the currently active HotSandboxNoteView, if any. */
	public getActiveView(): HotSandboxNoteView | null {
		return this.app.workspace.getActiveViewOfType(HotSandboxNoteView);
	}

	/** Returns all open HotSandboxNoteView instances. */
	getAllHotSandboxViews(): HotSandboxNoteView[] {
		const views: HotSandboxNoteView[] = [];
		this.app.workspace
			.getLeavesOfType(VIEW_TYPE_HOT_SANDBOX)
			.forEach((leaf) => {
				if (leaf.view instanceof HotSandboxNoteView) {
					views.push(leaf.view);
				}
			});
		return views;
	}
}
