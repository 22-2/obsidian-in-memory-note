import log from "loglevel";
import { Plugin } from "obsidian";
import type { AppEvents } from "./events/AppEvents";
import { AppOrchestrator } from "./managers/AppOrchestrator";
import { DatabaseManager } from "./managers/DatabaseManager";
import { SandboxNoteSettingTab } from "./settings";
import { EventEmitter } from "./utils/EventEmitter";
import { DEBUG_MODE, HOT_SANDBOX_NOTE_ICON } from "./utils/constants";
import "./utils/setup-logger";
import { overwriteLogLevel } from "./utils/setup-logger";
import { HotSandboxNoteView } from "./views/HotSandboxNoteView";
import { extractToFileInteraction } from "./views/internal/utils";

export const logger = log.getLogger("SandboxNote");

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
				const view = this.orchestrator.getActiveView();
				if (view instanceof HotSandboxNoteView) {
					if (!checking) {
						extractToFileInteraction(view).then((success) => {
							if (success && view.masterId) {
								this.orchestrator
									.get<DatabaseManager>("dbManager")
									.deleteFromAll(view.masterId);
							}
						});
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
		this.emitter.emit("plugin-unload", undefined);
		logger.debug("Sandbox Note plugin unloaded");
	}

	/**
	 * Activates a new hot sandbox view.
	 * This is delegated to the ViewFactory managed by the orchestrator.
	 */
	activateNewHotSandboxView() {
		return this.orchestrator.activateView();
	}

	/** Initialize logger with current settings. */
	applyLogger(): void {
		const settings = this.orchestrator?.getSettings();
		if (settings) {
			Object.values(log.getLoggers()).forEach((logger) => {
				logger.setLevel(settings.enableLogger ? "debug" : "warn");
			});
		} else {
			logger.setLevel("warn");
		}
		logger.debug("Logger initialized");
	}
}
