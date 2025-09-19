import { ItemView, WorkspaceLeaf } from "obsidian";
import { handleClick, handleContextMenu } from "src/click-handler";
import { SandboxEditor as SandboxEditor } from "src/sandboxEditor";
import { SANDBOX_NOTE_ICON, VIEW_TYPE } from "src/utils/constants";
import type SandboxNotePlugin from "./main";

/** View for an sandbox note with inline editor. */
export class SandboxNoteView extends ItemView {
	plugin: SandboxNotePlugin;
	sandboxEditor: SandboxEditor;
	private hasUnsavedChanges = false;
	private initialContent = "";

	navigation = true; // Prevent renaming prompts

	constructor(leaf: WorkspaceLeaf, plugin: SandboxNotePlugin) {
		super(leaf);
		this.plugin = plugin;
		this.sandboxEditor = new SandboxEditor(this);
	}

	/** Get editor instance. */
	get editor() {
		return this.sandboxEditor.getEditor();
	}

	save() {
		this.plugin.saveManager.saveNoteContentToFile(this);
	}

	/** Get view type. */
	getViewType() {
		return VIEW_TYPE;
	}

	/** Get display text for tab (shows * for unsaved changes). */
	getDisplayText() {
		const baseTitle = "Sandbox note";
		// Only show asterisk if save setting is enabled and there are unsaved changes
		const shouldShowUnsaved =
			this.plugin.settings.enableSaveNoteContent &&
			this.hasUnsavedChanges;
		return shouldShowUnsaved ? `*${baseTitle}` : baseTitle;
	}

	/** Get view icon. */
	getIcon() {
		return SANDBOX_NOTE_ICON;
	}

	/** Get ephemeral state for tab duplication. */
	getEphemeralState(): any {
		return { content: this.plugin.contentManager.sharedNoteContent };
	}

	/** Restore ephemeral state and update content. */
	setEphemeralState(state: any): void {
		if (state && typeof state.content === "string") {
			// Set initial content for the inline editor
			this.sandboxEditor.content = state.content;
			this.initialContent = state.content;

			// If the view is already loaded, update the editor immediately
			if (this.sandboxEditor.targetElement) {
				this.setContent(state.content);
			}
		}
	}

	/** Set editor content if different (for view sync). */
	setContent(content: string) {
		if (this.editor && this.editor.getValue() !== content) {
			this.editor.setValue(content);
			// Update unsaved state when content is synchronized from other views
			this.updateUnsavedState(content);
		}
	}

	/** Initialize view on open. */
	async onOpen() {
		// Register this view as active
		this.plugin.contentManager.addActiveView(this);

		// Synchronize content with existing views
		this.synchronizeWithExistingViews();

		// Initialize the inline editor with shared content
		this.sandboxEditor.content =
			this.plugin.contentManager.sharedNoteContent;
		this.initialContent = this.plugin.contentManager.sharedNoteContent;

		try {
			// Load the inline editor, which relies on private APIs
			await this.sandboxEditor.onload();

			// Create and load the editor container
			const editorContainer = this.contentEl.createEl("div", {
				cls: "sandbox-note-container",
			});
			this.sandboxEditor.load(editorContainer);

			// Set up event handlers and editor plugin connection
			this.setupEventHandlers();
			this.connectEditorPlugin();
		} catch (error) {
			console.error(
				"Sandbox Note: Failed to initialize inline editor.",
				error
			);
			// Display an error message to the user
			this.contentEl.empty();
			this.contentEl.createEl("div", {
				text: "Error: Could not initialize editor. This might be due to an Obsidian update.",
				cls: "sandbox-error-message",
			});
		}
	}

	/** Sync content with existing views. */
	private synchronizeWithExistingViews() {
		const existingViews = Array.from(
			this.plugin.contentManager.activeViews
		);
		if (existingViews.length > 1) {
			// Get content from an existing view (excluding this one)
			const sourceView = existingViews.find((view) => view !== this);
			if (sourceView && sourceView.editor) {
				this.plugin.contentManager.sharedNoteContent =
					sourceView.editor.getValue();
				// Also sync the initial content to match the existing view's state
				this.initialContent = sourceView.initialContent;
			}
		}
	}

	/** Setup DOM event handlers. */
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
				this.sandboxEditor.inlineView.editMode
			)
		);
	}

	/** Connect watch editor plugin for sync. */
	private connectEditorPlugin() {
		if (!this.editor) return;

		// TODO: Find a better way to ensure the editor plugin is ready
		// Delay connection to ensure editor is fully initialized
		setTimeout(() => {
			const editorPlugin = this.editor.cm.plugin(
				this.plugin.editorManager.watchEditorPlugin
			);
			if (editorPlugin) {
				editorPlugin.connectToPlugin(this.plugin, this);
			}
		}, 0);
	}

	/** Update unsaved state and refresh title. */
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

	/** Mark content as saved and remove unsaved indicator. */
	markAsSaved() {
		if (this.editor) {
			this.initialContent = this.editor.getValue();
			this.updateUnsavedState(this.initialContent);
		}
	}

	/** Cleanup on view close. */
	async onClose() {
		this.plugin.contentManager.removeActiveView(this);
		this.sandboxEditor.unload();
		this.contentEl.empty();
	}
}
