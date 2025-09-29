import log from "loglevel";
import type { App, Workspace } from "obsidian";
import { debounce } from "obsidian";
import type { AppEvents } from "src/events/AppEvents";
import type SandboxNotePlugin from "src/main";
import type { EventEmitter } from "src/utils/EventEmitter";
import type { Manager } from "./Manager";

type Context = {
	getActiveView: SandboxNotePlugin["getActiveView"];
	workspaceEvents: {
		on: Workspace["on"];
		off: Workspace["off"];
		onLayoutReady: Workspace["onLayoutReady"];
	};
};

/** Manages Obsidian workspace event handling */
export class ObsidianEventManager implements Manager {
	private debouncedEmitLayoutChange: () => void;

	constructor(
		private context: Context,
		private emitter: EventEmitter<AppEvents>
	) {
		this.debouncedEmitLayoutChange = debounce(
			this.emitLayoutChange.bind(this),
			50
		);
	}

	/** Set up all workspace event listeners */
	public load(): void {
		this.context.workspaceEvents.onLayoutReady(() =>
			this.emitLayoutChange()
		);
		this.context.workspaceEvents.on(
			"active-leaf-change",
			this.handleActiveLeafChange
		);
		this.context.workspaceEvents.on(
			"layout-change",
			this.debouncedEmitLayoutChange
		);
	}

	public unload(): void {
		this.context.workspaceEvents.off(
			"active-leaf-change",
			this.handleActiveLeafChange
		);
		this.context.workspaceEvents.off(
			"layout-change",
			this.debouncedEmitLayoutChange
		);
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
		const activeView = this.context.getActiveView();
		log.debug(`Active leaf changed to: ${activeView?.leaf?.id}`);
		this.emitter.emit("obsidian-active-leaf-changed", { view: activeView });
	};
}
