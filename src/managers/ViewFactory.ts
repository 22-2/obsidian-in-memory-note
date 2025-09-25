import type SandboxNotePlugin from "src/main";
import {
	VIEW_TYPE_HOT_SANDBOX,
	VIEW_TYPE_IN_MEMORY,
	VIEW_TYPE_SANDBOX,
} from "src/utils/constants";
import { activateView } from "src/utils/obsidian";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";
import { InMemoryNoteView } from "src/views/InMemoryNoteView";
import { SandboxNoteView } from "src/views/SandboxNoteView";
import type { Manager } from "./Manager";

/** Manages registration and activation of custom views */
export class ViewFactory implements Manager {
	private plugin: SandboxNotePlugin;

	constructor(plugin: SandboxNotePlugin) {
		this.plugin = plugin;
	}

	/** Register custom view types with Obsidian */
	public load(): void {
		// this.plugin.registerView(
		// 	VIEW_TYPE_SANDBOX,
		// 	(leaf) => new SandboxNoteView(leaf, this.plugin)
		// );
		// this.plugin.registerView(
		// 	VIEW_TYPE_IN_MEMORY,
		// 	(leaf) => new InMemoryNoteView(leaf, this.plugin)
		// );
		this.plugin.registerView(
			VIEW_TYPE_HOT_SANDBOX,
			(leaf) => new HotSandboxNoteView(leaf, this.plugin)
		);
	}

	/** Unregister custom view types */
	public unload(): void {
		this.plugin.app.workspace.detachLeavesOfType(VIEW_TYPE_SANDBOX);
		this.plugin.app.workspace.detachLeavesOfType(VIEW_TYPE_IN_MEMORY);
		this.plugin.app.workspace.detachLeavesOfType(VIEW_TYPE_HOT_SANDBOX);
	}

	/** Create and activate new Sandbox Note view */
	public async activateSandboxView() {
		return this.activateAbstractView(VIEW_TYPE_SANDBOX);
	}

	/** Create and activate new In-Memory Note view */
	public async activateInMemoryView() {
		return this.activateAbstractView(VIEW_TYPE_IN_MEMORY);
	}

	public async activateNewHotSandboxView() {
		// Pass an empty state to ensure a new noteGroupId is created
		return this.activateAbstractView(VIEW_TYPE_HOT_SANDBOX, {});
	}

	/**
	 * Helper function to open a view of a specific type in a new tab.
	 * @param type The view type to activate.
	 */
	private async activateAbstractView(type: string, state?: any) {
		const leaf = await activateView(this.plugin.app, {
			type,
			active: true,
			state,
		});

		return leaf;
	}
}
