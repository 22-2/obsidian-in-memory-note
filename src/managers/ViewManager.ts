import type { Plugin, Workspace, WorkspaceLeaf } from "obsidian";
import { uniqBy } from "src/utils";
import { VIEW_TYPE_HOT_SANDBOX } from "src/utils/constants";
import { activateView } from "src/utils/obsidian";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";
import { AbstractNoteView } from "src/views/internal/AbstractNoteView";
import type { CacheManager } from "./CacheManager";
import type { IManager } from "./IManager";

type Context = {
	registerView: Plugin["registerView"];
	getLeaf: Workspace["getLeaf"];
	detachLeavesOfType: Workspace["detachLeavesOfType"];
	getLeavesOfType: Workspace["getLeavesOfType"];
	getActiveViewOfType: Workspace["getActiveViewOfType"];
	getAllNotes: CacheManager["getAllSandboxes"];
	createView: (leaf: WorkspaceLeaf) => AbstractNoteView;
};

/** Manages registration and activation of custom views */
export class ViewManager implements IManager {
	constructor(private context: Context) {}

	/** Register custom view types with Obsidian */
	public load(): void {
		this.context.registerView(VIEW_TYPE_HOT_SANDBOX, (leaf) =>
			this.context.createView(leaf)
		);
	}

	/** Unregister custom view types */
	public unload(): void {
		this.context.detachLeavesOfType(VIEW_TYPE_HOT_SANDBOX);
	}

	public async activateView() {
		return activateView<AbstractNoteView>(
			{ getLeaf: (type) => this.context.getLeaf(type) },
			{
				type: VIEW_TYPE_HOT_SANDBOX,
				active: true,
			}
		);
	}

	/** Returns the currently active HotSandboxNoteView, if any. */
	public getActiveView(): HotSandboxNoteView | null {
		return this.context.getActiveViewOfType(HotSandboxNoteView);
	}

	/** Returns all open HotSandboxNoteView instances. */
	getAllViews(): HotSandboxNoteView[] {
		const views: HotSandboxNoteView[] = [];
		this.context.getLeavesOfType(VIEW_TYPE_HOT_SANDBOX).forEach((leaf) => {
			if (leaf.view instanceof HotSandboxNoteView) {
				views.push(leaf.view);
			}
		});
		return views;
	}

	public isLastHotView(masterId: string) {
		const allViews = this.getAllViews();
		const map = Object.groupBy(allViews, (view) => view.masterId!);
		return map[masterId]?.length === 1;
	}

	public indexOfMasterId(masterId: string): number {
		const masterNotes = uniqBy(this.context.getAllNotes(), (n) => n.id);
		return masterNotes.findIndex((note) => note.id === masterId);
	}
}
