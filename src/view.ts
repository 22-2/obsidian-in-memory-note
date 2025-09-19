import { ItemView, WorkspaceLeaf } from "obsidian";
import { handleClick, handleContextMenu } from "src/click-handler";
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
		return { content: this.plugin.noteContent };
	}

	/**
	 * Sets the ephemeral state of the view, updating the editor content.
	 * @param state The state object containing the new content.
	 */
	setEphemeralState(state: any): void {
		if (state && typeof state.content === "string") {
			// Set the initial content for the inline editor.
			// This is important for when the view is first created.
			this.inlineEditor.content = state.content;

			// If the view is already loaded (e.g., navigating back and forth),
			// update the editor content immediately.
			if (this.inlineEditor.target) {
				this.setContent(state.content);
			}
		}
	}

	/**
	 * Sets the content of the editor if it differs from the current content.
	 * This is called by the plugin to synchronize views.
	 * @param content The new content to set.
	 */
	setContent(content: string) {
		if (this.editor && this.editor.getValue() !== content) {
			this.editor.setValue(content);
		}
	}

	/**
	 * Called when the view is opened. Loads the inline editor.
	 */
	async onOpen() {
		this.plugin.activeViews.add(this);
		// Set initial content from the shared state.
		this.inlineEditor.content = this.plugin.noteContent;

		await this.inlineEditor.onload();

		const container = this.contentEl.createEl("div", {
			cls: "in-memory-note-container",
		});

		this.inlineEditor.load(container);

		if (this.editor) {
			this.registerDomEvent(
				this.contentEl,
				"mousedown",
				handleClick.bind(null, this.editor)
			);
			this.registerDomEvent(
				this.contentEl,
				"contextmenu",
				handleContextMenu.bind(
					null,
					this.app.commands,
					this.inlineEditor.inlineView.editMode
				)
			);
		}
	}

	/**
	 * Called when the view is closed. Unloads the inline editor.
	 */
	async onClose() {
		this.plugin.activeViews.delete(this);
		this.inlineEditor.unload();
		this.contentEl.empty();
	}
}
