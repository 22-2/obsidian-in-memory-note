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
	 * Gets the ephemeral (temporary) state of the view for operations like tab duplication.
	 * This state includes the current editor content but is not permanently saved.
	 */
	getEphemeralState(): any {
		return { content: this.plugin.sharedNoteContent };
	}

	/**
	 * Restores the ephemeral state of the view, updating the editor content.
	 * @param state The state object containing the content to restore.
	 */
	setEphemeralState(state: any): void {
		if (state && typeof state.content === "string") {
			// Set initial content for the inline editor
			this.inlineEditor.content = state.content;

			// If the view is already loaded, update the editor immediately
			if (this.inlineEditor.targetElement) {
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
	 * Initializes the view when opened. Sets up the inline editor and event handlers.
	 */
	async onOpen() {
		// Register this view as active
		this.plugin.activeViews.add(this);
		
		// Synchronize content with existing views
		this.synchronizeWithExistingViews();
		
		// Initialize the inline editor with shared content
		this.inlineEditor.content = this.plugin.sharedNoteContent;
		await this.inlineEditor.onload();

		// Create and load the editor container
		const editorContainer = this.contentEl.createEl("div", {
			cls: "in-memory-note-container",
		});
		this.inlineEditor.load(editorContainer);

		// Set up event handlers and editor plugin connection
		this.setupEventHandlers();
		this.connectEditorPlugin();
	}

	/**
	 * Synchronizes content with existing views to ensure consistency.
	 */
	private synchronizeWithExistingViews() {
		const existingViews = Array.from(this.plugin.activeViews);
		if (existingViews.length > 1) {
			// Get content from an existing view (excluding this one)
			const sourceView = existingViews.find(view => view !== this);
			if (sourceView && sourceView.editor) {
				this.plugin.sharedNoteContent = sourceView.editor.getValue();
			}
		}
	}

	/**
	 * Sets up DOM event handlers for click and context menu interactions.
	 */
	private setupEventHandlers() {
		if (!this.editor) return;

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

	/**
	 * Connects the watch editor plugin to enable content synchronization.
	 */
	private connectEditorPlugin() {
		if (!this.editor) return;

		// Delay connection to ensure editor is fully initialized
		setTimeout(() => {
			const editorPlugin = this.editor.cm.plugin(this.plugin.watchEditorPlugin);
			if (editorPlugin) {
				editorPlugin.connectToPlugin(this.plugin, this);
			}
		}, 100);
	}

	/**
	 * Cleanup when the view is closed. Unloads the inline editor and removes from active views.
	 */
	async onClose() {
		this.plugin.activeViews.delete(this);
		this.inlineEditor.unload();
		this.contentEl.empty();
	}
}
