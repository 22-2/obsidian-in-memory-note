import type SandboxNotePlugin from "src/main";
import { VIEW_TYPE_IN_MEMORY, VIEW_TYPE_SANDBOX } from "src/utils/constants";
import { activateView } from "src/utils/obsidian";
import { InMemoryNoteView } from "src/views/InMemoryNoteView";
import { SandboxNoteView } from "src/views/SandboxNoteView";

/** Manages registration and activation of custom views */
export class ViewActivator {
	private plugin: SandboxNotePlugin;

	constructor(plugin: SandboxNotePlugin) {
		this.plugin = plugin;
	}

	/** Register custom view types with Obsidian */
	public registerViews(): void {
		this.plugin.registerView(
			VIEW_TYPE_SANDBOX,
			(leaf) => new SandboxNoteView(leaf, this.plugin)
		);
		this.plugin.registerView(
			VIEW_TYPE_IN_MEMORY,
			(leaf) => new InMemoryNoteView(leaf, this.plugin)
		);
	}

	/** Create and activate new Sandbox Note view */
	public async activateSandboxView() {
		return this.activateAbstractView(VIEW_TYPE_SANDBOX);
	}

	/** Create and activate new In-Memory Note view */
	public async activateInMemoryView() {
		return this.activateAbstractView(VIEW_TYPE_IN_MEMORY);
	}

	/**
	 * Helper function to open a view of a specific type in a new tab.
	 * @param type The view type to activate.
	 */
	private async activateAbstractView(type: string) {
		const leaf = await activateView(this.plugin.app, {
			type,
			active: true,
		});

		return leaf;
	}
}
