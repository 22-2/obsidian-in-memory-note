import { SandboxNoteView } from "../views/SandboxNoteView";
import log from "loglevel";
import type { AbstractNoteView } from "src/views/internal/AbstractNoteView"; // 追記
import type { EventEmitter } from "src/utils/EventEmitter";
import type { AppEvents } from "src/events/AppEvents";
import type { Manager } from "./Manager";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";

/** Manages shared content synchronization across views */
export class EditorSyncManager implements Manager {
	private emitter: EventEmitter<AppEvents>;

	// --- For original SandboxNoteView ---
	currentSharedNoteContent = "";
	lastSavedContent = "";
	hasUnsavedChanges = false;
	activeViews: Set<SandboxNoteView> = new Set();

	// --- For new HotSandboxNoteView ---
	private hotNotesContent = new Map<string, string>();
	private hotActiveViews = new Map<string, Set<AbstractNoteView>>();

	constructor(emitter: EventEmitter<AppEvents>) {
		this.emitter = emitter;
	}

	public load(): void {
		this.emitter.on(
			"editor-content-changed",
			this.handleEditorContentChanged
		);
		this.emitter.on("content-saved", this.handleContentSaved);
	}

	public unload(): void {
		this.emitter.off(
			"editor-content-changed",
			this.handleEditorContentChanged
		);
		this.emitter.off("content-saved", this.handleContentSaved);
	}

	private handleEditorContentChanged = (
		payload: AppEvents["editor-content-changed"]
	) => {
		const { content, sourceView } = payload;

		if (
			sourceView instanceof HotSandboxNoteView &&
			sourceView.noteGroupId
		) {
			this.syncHotViews(sourceView.noteGroupId, content, sourceView);
		} else if (sourceView instanceof SandboxNoteView) {
			this.syncAll(content, sourceView);
		}

		this.refreshAllViewTitles();
		this.refreshAllViewActionButtons();
	};

	private handleContentSaved = (payload: AppEvents["content-saved"]) => {
		const { view } = payload;
		if (view instanceof SandboxNoteView) {
			this.markAsSaved();
			this.refreshAllViewTitles();
			this.refreshAllViewActionButtons();
		}
	};

	public getGroupNumber(noteGroupId: string): number {
		const sortedGroupIds = Array.from(this.hotNotesContent.keys()).sort();
		const groupIndex = sortedGroupIds.indexOf(noteGroupId);
		return groupIndex !== -1 ? groupIndex + 1 : 0;
	}

	/** Update shared content and sync across all views */
	syncAll(content: string, sourceView: AbstractNoteView) {
		log.debug(
			`Updating note content from view: ${sourceView.getViewType()}`
		);
		this.currentSharedNoteContent = content;
		this.updateUnsavedState();

		for (const view of this.activeViews) {
			if (view !== sourceView) {
				log.debug(`Syncing content to view: ${view.getViewType()}`);
				view.setContent(content);
			}
		}
	}

	private updateUnsavedState() {
		const wasUnsaved = this.hasUnsavedChanges;
		this.hasUnsavedChanges =
			this.currentSharedNoteContent !== this.lastSavedContent;

		if (wasUnsaved !== this.hasUnsavedChanges) {
			log.debug(`Unsaved state changed to: ${this.hasUnsavedChanges}`);
			this.emitter.emit("unsaved-state-changed", {
				hasUnsavedChanges: this.hasUnsavedChanges,
			});
		}
	}

	markAsSaved() {
		this.lastSavedContent = this.currentSharedNoteContent;
		this.updateUnsavedState();
		log.debug("Content marked as saved.");
	}

	addActiveView(view: SandboxNoteView) {
		log.debug(
			`Adding active view: ${view.getViewType()}, total: ${
				this.activeViews.size + 1
			}`
		);
		this.activeViews.add(view);
		view.updateActionButtons();
	}

	removeActiveView(view: SandboxNoteView) {
		log.debug(
			`Removing active view: ${view.getViewType()}, remaining: ${
				this.activeViews.size - 1
			}`
		);
		this.activeViews.delete(view);
	}

	refreshAllViewTitles() {
		for (const view of this.activeViews) {
			view.leaf.updateHeader();
		}

		for (const viewSet of this.hotActiveViews.values()) {
			for (const view of viewSet) {
				view.leaf.updateHeader();
			}
		}
	}

	public refreshAllViewActionButtons() {
		for (const view of this.activeViews) {
			view.updateActionButtons();
		}
	}

	public registerNewHotNote(noteGroupId: string) {
		if (!this.hotNotesContent.has(noteGroupId)) {
			this.hotNotesContent.set(noteGroupId, "");
			log.debug(`Registered new hot note group: ${noteGroupId}`);
		}
	}

	public setInitialHotNotes(notes: { id: string; content: string }[]) {
		for (const note of notes) {
			this.hotNotesContent.set(note.id, note.content);
		}
	}

	public getHotNoteContent(noteGroupId: string): string {
		return this.hotNotesContent.get(noteGroupId) ?? "";
	}

	public addHotActiveView(view: HotSandboxNoteView) {
		if (!view.noteGroupId) return;
		const { noteGroupId } = view;
		if (!this.hotActiveViews.has(noteGroupId)) {
			this.hotActiveViews.set(noteGroupId, new Set());
		}
		this.hotActiveViews.get(noteGroupId)?.add(view);
		log.debug(
			`Added hot sandbox view to group ${noteGroupId}. Total in group: ${
				this.hotActiveViews.get(noteGroupId)?.size
			}`
		);
		view.leaf.updateHeader();
	}

	public removeHotActiveView(view: HotSandboxNoteView) {
		if (!view.noteGroupId) return;
		const { noteGroupId } = view;
		const viewSet = this.hotActiveViews.get(noteGroupId);
		if (viewSet) {
			viewSet.delete(view);
			if (viewSet.size === 0) {
				this.hotActiveViews.delete(noteGroupId);
			}
		}
		log.debug(
			`Removed hot sandbox view from group ${noteGroupId}. Remaining in group: ${
				viewSet?.size ?? 0
			}`
		);
	}

	public isLastHotView(view: HotSandboxNoteView): boolean {
		if (!view.noteGroupId) return false;
		const viewSet = this.hotActiveViews.get(view.noteGroupId);
		return viewSet?.size === 1 && viewSet.has(view);
	}

	public syncHotViews(
		noteGroupId: string,
		content: string,
		sourceView: AbstractNoteView
	) {
		this.hotNotesContent.set(noteGroupId, content);
		log.debug(`Syncing hot sandbox note content for group: ${noteGroupId}`);

		const viewSet = this.hotActiveViews.get(noteGroupId);
		if (!viewSet) return;

		for (const view of viewSet) {
			if (view !== sourceView) {
				view.setContent(content);
			}
			view.leaf.updateHeader();
		}
	}

	public clearHotNoteData(noteGroupId: string) {
		this.hotNotesContent.delete(noteGroupId);
		this.hotActiveViews.delete(noteGroupId);
	}
}
