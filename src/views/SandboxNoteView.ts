// E:\Desktop\coding\pub\obsidian-sandbox-note\src\views\SandboxNoteView.ts
import { WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_SANDBOX } from "src/utils/constants";
import type SandboxNotePlugin from "../main";
import { synchronizeWithExistingViews } from "../helpers/viewSync";
import { AbstractNoteView } from "./helpers/AbstractNoteView";

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

	/** On open, register this view with the ContentManager. */
	async onOpen() {
		this.plugin.contentManager.addActiveView(this);
		await super.onOpen();
	}

	/** On close, unregister this view. */
	async onClose() {
		this.plugin.contentManager.removeActiveView(this);
		await super.onClose();
	}
}
