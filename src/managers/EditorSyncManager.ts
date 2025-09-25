import log from "loglevel";
import type { AbstractNoteView } from "src/views/internal/AbstractNoteView";
import type { EventEmitter } from "src/utils/EventEmitter";
import type { AppEvents } from "src/events/AppEvents";
import type { Manager } from "./Manager";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";
import type { StateManager } from "./StateManager";
import { uniqBy } from "src/utils";

/** Manages shared content synchronization across views */
export class EditorSyncManager implements Manager {
	private emitter: EventEmitter<AppEvents>;
	private stateManager: StateManager;

	// --- For new HotSandboxNoteView ---
	private hotActiveViews = new Map<string, Set<AbstractNoteView>>();

	constructor(emitter: EventEmitter<AppEvents>, stateManager: StateManager) {
		this.emitter = emitter;
		this.stateManager = stateManager;
	}

	public load(): void {
		this.emitter.on(
			"editor-content-changed",
			this.handleEditorContentChanged
		);
		this.emitter.on("view-opened", this.handleViewOpened);
		this.emitter.on("view-closed", this.handleViewClosed);
		this.emitter.on("settings-changed", this.handleSettingsChanged);
	}

	public unload(): void {
		this.emitter.off(
			"editor-content-changed",
			this.handleEditorContentChanged
		);
		this.emitter.off("view-opened", this.handleViewOpened);
		this.emitter.off("view-closed", this.handleViewClosed);
		this.emitter.off("settings-changed", this.handleSettingsChanged);
	}

	private handleSettingsChanged = () => {
		this.refreshAllViewTitles();
	};

	private handleViewOpened = (payload: AppEvents["view-opened"]) => {
		const { view } = payload;
		if (view instanceof HotSandboxNoteView) {
			this.addHotActiveView(view);
			if (view.masterNoteId) {
				view.setContent(this.getHotNoteContent(view.masterNoteId));
			}
		}
	};

	private handleViewClosed = (payload: AppEvents["view-closed"]) => {
		const { view } = payload;
		if (view instanceof HotSandboxNoteView) {
			this.removeHotActiveView(view);
		}
	};

	private handleEditorContentChanged = (
		payload: AppEvents["editor-content-changed"]
	) => {
		const { content, sourceView } = payload;

		if (
			sourceView instanceof HotSandboxNoteView &&
			sourceView.masterNoteId
		) {
			this.syncHotViews(sourceView.masterNoteId, content, sourceView);
		}

		this.refreshAllViewTitles();
	};

	public indexOfMasterId(masterNoteId: string): number {
		const masterNotes = uniqBy(
			this.stateManager.getAllHotNotes(),
			(n) => n.id
		);
		return masterNotes.findIndex((note) => note.id === masterNoteId);
	}

	refreshAllViewTitles() {
		for (const viewSet of this.hotActiveViews.values()) {
			for (const view of viewSet) {
				view.leaf.updateHeader();
			}
		}
	}

	public getHotNoteContent(masterNoteId: string): string {
		return this.stateManager.getHotNoteContent(masterNoteId);
	}

	public addHotActiveView(view: HotSandboxNoteView) {
		if (!view.masterNoteId) return;
		const { masterNoteId } = view;
		if (!this.hotActiveViews.has(masterNoteId)) {
			this.hotActiveViews.set(masterNoteId, new Set());
		}
		this.hotActiveViews.get(masterNoteId)?.add(view);
		log.debug(
			`Added hot sandbox view to group ${masterNoteId}. Total in group: ${
				this.hotActiveViews.get(masterNoteId)?.size
			}`
		);
		view.leaf.updateHeader();
	}

	public removeHotActiveView(view: HotSandboxNoteView) {
		if (!view.masterNoteId) return;
		const { masterNoteId } = view;
		const viewSet = this.hotActiveViews.get(masterNoteId);
		if (viewSet) {
			viewSet.delete(view);
			if (viewSet.size === 0) {
				this.hotActiveViews.delete(masterNoteId);
			}
		}
		log.debug(
			`Removed hot sandbox view from group ${masterNoteId}. Remaining in group: ${
				viewSet?.size ?? 0
			}`
		);
	}

	public isLastHotView(view: HotSandboxNoteView): boolean {
		if (!view.masterNoteId) return false;
		const viewSet = this.hotActiveViews.get(view.masterNoteId);
		return viewSet?.size === 1 && viewSet.has(view);
	}

	public syncHotViews(
		masterNoteId: string,
		content: string,
		sourceView: AbstractNoteView
	) {
		log.debug(
			`Syncing hot sandbox note content for group: ${masterNoteId}`
		);

		const viewSet = this.hotActiveViews.get(masterNoteId);
		if (!viewSet) return;

		for (const view of viewSet) {
			if (view !== sourceView) {
				view.setContent(content);
			}
			view.leaf.updateHeader();
		}
	}

	public clearHotNoteData(masterNoteId: string) {
		this.hotActiveViews.delete(masterNoteId);
	}
}
