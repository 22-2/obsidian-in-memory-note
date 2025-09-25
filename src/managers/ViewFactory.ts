import type SandboxNotePlugin from "src/main";
import { VIEW_TYPE_HOT_SANDBOX } from "src/utils/constants";
import { activateView } from "src/utils/obsidian";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";
import type { Manager } from "./Manager";

/** Manages registration and activation of custom views */
export class ViewFactory implements Manager {
	private plugin: SandboxNotePlugin;

	constructor(plugin: SandboxNotePlugin) {
		this.plugin = plugin;
	}

	/** Register custom view types with Obsidian */
	public load(): void {
		this.plugin.registerView(
			VIEW_TYPE_HOT_SANDBOX,
			(leaf) =>
				new HotSandboxNoteView(
					leaf,
					this.plugin.emitter,
					this.plugin.stateManager,
					this.plugin.editorSyncManager
				)
		);
	}

	/** Unregister custom view types */
	public unload(): void {
		this.plugin.app.workspace.detachLeavesOfType(VIEW_TYPE_HOT_SANDBOX);
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
		const leaf = await activateView(this.plugin.app, {
			type,
			active: true,
			state,
		});

		return leaf;
	}
}
