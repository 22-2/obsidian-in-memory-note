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

		this.registerDomEventHandlers(window);

		this.registerEvent(
			this.app.workspace.on("window-open", (win) => {
				this.registerDomEventHandlers(win.win);
			})
		);

		this.registerEvent(
			this.app.workspace.on("window-close", (win) => {
				this.removeDomEventHandlers(win.win);
			})
		);

		getAllWorkspaceWindows(this.app).forEach((win) => {
			this.registerDomEventHandlers(win.win);
		});
	}

	onunload() {
		getAllWorkspaceWindows(this.app).forEach((win) => {
			this.removeDomEventHandlers(win.win);
		});
	}

	private removeDomEventHandlers = (target: Window) => {
		target.removeEventListener("mousedown", this.handleClick);
		target.removeEventListener("contextmenu", this.handleContextMenu);
	};

	private handleContextMenu = async (e: MouseEvent) => {
		const target = e.target;
		if (!(target instanceof HTMLElement)) return;

		if (!target.matches(".view-content")) return;
		this.app.commands.executeCommandById("editor:context-menu");

		try {
			const menu = await waitForElement(".menu", document);
			Object.assign(menu.style, {
				top: `${e.y}px`,
				left: `${e.x}px`,
			});
		} catch (error) {
			console.log(
				"Focus Canvas Plugin: Menu element not found within timeout."
			);
		}
	};

	private handleClick = (e: MouseEvent) => {
		const target = e.target;
		if (!(target instanceof HTMLElement)) return;
		if (!target.matches(".view-content")) return;
		let editor = this.app.workspace.activeEditor?.editor;
		const pos = editor.posAtMouse(e);
		setTimeout(() => {
			editor.setCursor(pos);
			editor.setSelection(pos, pos);
			editor.focus();
		}, 0);
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

/**
 * 指定されたセレクタのDOM要素が見つかるまで待機する
 */
function waitForElement(
	cssSelector: string,
	doc: Document = document,
	timeout = 10 * 1000
): Promise<HTMLElement> {
	return new Promise((resolve, reject) => {
		const element = doc.querySelector(cssSelector) as HTMLElement;
		if (element) {
			resolve(element);
			return;
		}
		const observer = new MutationObserver(() => {
			const element = doc.querySelector(cssSelector) as HTMLElement;
			if (element) {
				observer.disconnect();
				resolve(element);
			}
		});
		observer.observe(doc.documentElement, {
			childList: true,
			subtree: true,
		});
		setTimeout(() => {
			observer.disconnect();
			reject(new Error(`Timeout: ${timeout} ms`));
		}, timeout);
	});
}
