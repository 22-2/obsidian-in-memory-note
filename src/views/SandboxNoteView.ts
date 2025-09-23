import { WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_SANDBOX } from "src/utils/constants";
import type SandboxNotePlugin from "../main";
import { synchronizeWithExistingViews } from "../helpers/viewSync";
import { AbstractNoteView } from "./helpers/AbstractNoteView";
import log from "loglevel";

/** View for a synchronized, persistent sandbox note. */
export class SandboxNoteView extends AbstractNoteView {
	constructor(leaf: WorkspaceLeaf, plugin: SandboxNotePlugin) {
		super(leaf, plugin);
	}

	/** Get view type. */
	getViewType() {
		return VIEW_TYPE_SANDBOX;
	}

	/** Get the base title for the view. */
	getBaseTitle(): string {
		return "Sandbox Note";
	}

	/** Load content from the shared ContentManager and synchronize. */
	async loadInitialContent(): Promise<string> {
		synchronizeWithExistingViews(this);
		return this.plugin.contentManager.sharedNoteContent;
	}

	/** A change in this view should be broadcast to other sandbox views. */
	override onContentChanged(content: string): void {
		// Broadcast content changes to other views
		this.plugin.contentManager.updateNoteContent(content, this);

		// Trigger debounced save if the setting is enabled
		if (this.plugin.settings.enableSaveNoteContent) {
			this.plugin.saveManager.debouncedSave(this);
		}
	}

	/** Save the content using the SaveManager. */
	async save(): Promise<void> {
		await this.plugin.saveManager.saveNoteContentToFile(this);
	}

	/** Get ephemeral state for tab duplication. */
	// getEphemeralState(): any {
	// 	return { content: this.plugin.contentManager.sharedNoteContent };
	// }

	// /** Restore ephemeral state and update content. */
	// setEphemeralState(state: any): void {
	// 	if (state && typeof state.content === "string") {
	// 		// Set initial content for the inline editor
	// 		this.wrapper.content = state.content;
	// 		this.initialContent = state.content;

	// 		// If the view is already loaded, update the editor immediately
	// 		if (this.wrapper.targetEl) {
	// 			this.setContent(state.content);
	// 		}
	// 	}
	// }

	/** On open, register this view with the ContentManager. */
	async onOpen() {
		this.plugin.contentManager.addActiveView(this);
		this.plugin.registerDomEvent(window, "keydown", this.onKeyDown, {
			capture: true,
		});
		await super.onOpen();
	}

	onKeyDown = (e: KeyboardEvent) => {
		const activeView =
			this.app.workspace.getActiveViewOfType(AbstractNoteView);
		if (
			activeView &&
			this.plugin.settings.enableCtrlS &&
			e.ctrlKey &&
			e.key === "s"
		) {
			log.debug("save!");
			this.save();
		}
	};

	/** On close, unregister this view. */
	async onClose() {
		await super.onClose();
		this.plugin.contentManager.removeActiveView(this);
	}
}
