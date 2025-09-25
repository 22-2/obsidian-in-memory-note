import log from "loglevel";
import type { App, Workspace } from "obsidian";
import { debounce } from "obsidian";
import type { AppEvents } from "src/events/AppEvents";
import type SandboxNotePlugin from "src/main";
import type { EventEmitter } from "src/utils/EventEmitter";
import type { Manager } from "./Manager";

/** Manages Obsidian workspace event handling */
export class ObsidianEventManager implements Manager {
	private plugin: SandboxNotePlugin;
	private workspace: Workspace;
	private emitter: EventEmitter<AppEvents>;
	private debouncedEmitLayoutChange: () => void;

	constructor(plugin: SandboxNotePlugin, emitter: EventEmitter<AppEvents>) {
		this.plugin = plugin;
		this.workspace = plugin.app.workspace;
		this.emitter = emitter;
		this.debouncedEmitLayoutChange = debounce(
			this.emitLayoutChange.bind(this),
			50
		);
	}

	/** Set up all workspace event listeners */
	public load(): void {
		this.workspace.onLayoutReady(() => this.emitLayoutChange());
		this.workspace.on("active-leaf-change", this.handleActiveLeafChange);
		this.workspace.on("layout-change", this.debouncedEmitLayoutChange);
	}

	public unload(): void {
		this.workspace.off("active-leaf-change", this.handleActiveLeafChange);
		this.workspace.off("layout-change", this.debouncedEmitLayoutChange);
	}

	/** Emits an event to notify other managers about a layout change. */
	private emitLayoutChange(): void {
		log.debug("Workspace layout ready/changed, emitting event.");
		this.emitter.emit("obsidian-layout-changed", undefined);
	}

	/**
	 * Handles active leaf changes and emits an event with the new active view.
	 */
	private handleActiveLeafChange = () => {
		const activeView = this.plugin.getActiveAbstractNoteView();
		log.debug(`Active leaf changed to: ${this.workspace.activeLeaf?.id}`);
		this.emitter.emit("obsidian-active-leaf-changed", { view: activeView });
	};
}
