import { ItemView, WorkspaceLeaf } from "obsidian";
import { InlineEditor } from "src/inline-editor";
import { IN_MEMORY_NOTE_ICON, VIEW_TYPE } from "src/utils/constants";
import type InMemoryNotePlugin from "./main";

/**
 * Represents the view for an in-memory note.
 * This view hosts an inline editor and manages its lifecycle.
 */
export class InMemoryNoteView extends ItemView {
	plugin: InMemoryNotePlugin;
	inlineEditor: InlineEditor;

	constructor(leaf: WorkspaceLeaf, plugin: InMemoryNotePlugin) {
		super(leaf);
		this.plugin = plugin;
		this.inlineEditor = new InlineEditor(this);
	}

	/**
	 * Returns the editor instance from the inline editor.
	 */
	get editor() {
		return this.inlineEditor.getEditor();
	}

	/**
	 * Returns the unique view type.
	 */
	getViewType() {
		return VIEW_TYPE;
	}

	/**
	 * Returns the display text for the view tab.
	 */
	getDisplayText() {
		return "In-memory note";
	}

	/**
	 * Returns the icon for the view tab.
	 */
	getIcon() {
		return IN_MEMORY_NOTE_ICON;
	}

	/**
	 * Gets the ephemeral (temporary) state of the view, which includes the editor content.
	 * This state is not saved permanently but is used for operations like tab duplication.
	 */
	getEphemeralState(): any {
		// If the view is not loaded, use the content from the inline editor's property.
		// Otherwise, get the current content from the editor itself.
		const content = this.inlineEditor.target
			? this.inlineEditor.getContent()
			: this.inlineEditor.content;
		return { content };
	}

	/**
	 * Sets the ephemeral state of the view, updating the editor content.
	 * @param state The state object containing the new content.
	 */
	setEphemeralState(state: any): void {
		if (state && typeof state.content === "string") {
			this.inlineEditor.content = state.content;

			// If the view is already loaded, update the editor content immediately.
			if (this.inlineEditor.target) {
				this.inlineEditor.setContent(state.content);
			}
		}
	}

	/**
	 * Called when the view is opened. Loads the inline editor.
	 */
	async onOpen() {
		await this.inlineEditor.onload();

		const container = this.contentEl.createEl("div", {
			cls: "in-memory-note-container",
		});

		this.inlineEditor.load(container);
	}

	/**
	 * Called when the view is closed. Unloads the inline editor.
	 */
	async onClose() {
		this.inlineEditor.unload();
		this.contentEl.empty();
	}
}
