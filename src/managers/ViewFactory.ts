import type SandboxNotePlugin from "src/main";
import { VIEW_TYPE_HOT_SANDBOX } from "src/utils/constants";
import { activateView } from "src/utils/obsidian";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";
import { AbstractNoteView } from "src/views/internal/AbstractNoteView";
import type { Manager } from "./Manager";
import type { Plugin, Workspace, WorkspaceLeaf } from "obsidian";

type Context = {
	registerView: Plugin["registerView"];
	createView: (leaf: WorkspaceLeaf) => AbstractNoteView;
	getLeaf: Workspace["getLeaf"];
	detachLeavesOfType: Workspace["detachLeavesOfType"];
	getLeavesOfType: Workspace["getLeavesOfType"];
	getActiveViewOfType: Workspace["getActiveViewOfType"];
};

/** Manages registration and activation of custom views */
export class ViewFactory implements Manager {
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

	public async activateNewHotSandboxView() {
		// Pass an empty state to ensure a new masterNoteId is created
		return this.activateAbstractView(VIEW_TYPE_HOT_SANDBOX, {});
	}

	/**
	 * Helper function to open a view of a specific type in a new tab.
	 * @param type The view type to activate.
	 */
	private async activateAbstractView(type: string, state?: any) {
		const leaf = await activateView<AbstractNoteView>(
			{ getLeaf: (type) => this.context.getLeaf(type) },
			{
				type,
				active: true,
				state,
			}
		);

		return leaf;
	}

	/** Returns the currently active HotSandboxNoteView, if any. */
	public getActiveView(): HotSandboxNoteView | null {
		return this.context.getActiveViewOfType(HotSandboxNoteView);
	}

	/** Returns all open HotSandboxNoteView instances. */
	getAllHotSandboxViews(): HotSandboxNoteView[] {
		const views: HotSandboxNoteView[] = [];
		this.context.getLeavesOfType(VIEW_TYPE_HOT_SANDBOX).forEach((leaf) => {
			if (leaf.view instanceof HotSandboxNoteView) {
				views.push(leaf.view);
			}
		});
		return views;
	}

	public isLastHotView(masterNoteId: string) {
		const allViews = this.getAllHotSandboxViews();
		const map = Object.groupBy(allViews, (view) => view.masterNoteId!);
		return map[masterNoteId]?.length === 1;
	}
}
