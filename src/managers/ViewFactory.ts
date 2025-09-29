import type SandboxNotePlugin from "src/main";
import { VIEW_TYPE_HOT_SANDBOX } from "src/utils/constants";
import { activateView } from "src/utils/obsidian";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";
import { AbstractNoteView } from "src/views/internal/AbstractNoteView";
import type { Manager } from "./Manager";
import type { Workspace, WorkspaceLeaf } from "obsidian";

type Context = {
	registerView: (
		viewType: string,
		viewFactory: (leaf: WorkspaceLeaf) => AbstractNoteView
	) => void;
	createView: (leaf: WorkspaceLeaf) => AbstractNoteView;
	getLeaf: Workspace["getLeaf"];
	detachAll: (type: string) => void;
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
		this.context.detachAll(VIEW_TYPE_HOT_SANDBOX);
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
}
