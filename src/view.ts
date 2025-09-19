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
	private hasUnsavedChanges = false;
	private initialContent = "";

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
	 * Shows an asterisk (*) prefix when there are unsaved changes and save setting is enabled.
	 */
	getDisplayText() {
		const baseTitle = "In-memory note";
		// Only show asterisk if save setting is enabled and there are unsaved changes
		const shouldShowUnsaved = this.plugin.settings.enableSaveNoteContent && this.hasUnsavedChanges;
		return shouldShowUnsaved ? `*${baseTitle}` : baseTitle;
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
			this.initialContent = state.content;

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
			// Update unsaved state when content is synchronized from other views
			this.updateUnsavedState(content);
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
		this.initialContent = this.plugin.sharedNoteContent;
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
				// Also sync the initial content to match the existing view's state
				this.initialContent = sourceView.initialContent;
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
	 * Updates the unsaved state based on current content and refreshes the title.
	 * Only tracks changes when save setting is enabled.
	 * @param currentContent The current editor content to compare against initial state.
	 */
	updateUnsavedState(currentContent: string) {
		// Only track unsaved state when save setting is enabled
		if (!this.plugin.settings.enableSaveNoteContent) {
			this.hasUnsavedChanges = false;
			return;
		}

		const wasUnsaved = this.hasUnsavedChanges;
		this.hasUnsavedChanges = currentContent !== this.initialContent;
		
		// Update the tab title if the unsaved state changed
		if (wasUnsaved !== this.hasUnsavedChanges) {
			this.leaf.updateHeader();
		}
	}

	/**
	 * Marks the current content as saved by updating the initial content reference.
	 * This removes the unsaved state indicator.
	 */
	markAsSaved() {
		if (this.editor) {
			this.initialContent = this.editor.getValue();
			this.updateUnsavedState(this.initialContent);
		}
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
