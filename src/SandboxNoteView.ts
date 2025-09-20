import { ItemView, WorkspaceLeaf } from "obsidian";
import { handleClick, handleContextMenu } from "src/click-handler";
import { EditorWrapper } from "src/editorWrapper";
import { SANDBOX_NOTE_ICON, VIEW_TYPE } from "src/utils/constants";
import type SandboxNotePlugin from "./main";
import { getDisplayText, updateActionButtons } from "./viewHelpers";
import { setContent, synchronizeWithExistingViews } from "./viewSync";

/** View for an sandbox note with inline editor. */
export class SandboxNoteView extends ItemView {
	plugin: SandboxNotePlugin;
	public wrapper: EditorWrapper;
	hasUnsavedChanges = false;
	initialContent = "";
	saveActionEl!: HTMLElement;
	private onloadCallbacks: (() => void)[] = [];

	navigation = true; // Prevent renaming prompts

	constructor(leaf: WorkspaceLeaf, plugin: SandboxNotePlugin) {
		super(leaf);
		this.plugin = plugin;
		this.wrapper = new EditorWrapper(this);
	}

	/** Get editor instance. */
	get editor() {
		return this.wrapper.getEditor();
	}

	save = () => {
		return this.plugin.saveManager.saveNoteContentToFile(this);
	};

	loadContent = () => {
		this.setContent(this.plugin.contentManager.sharedNoteContent);
	};

	/** Get view type. */
	getViewType() {
		return VIEW_TYPE;
	}

	/** Get display text for tab (shows * for unsaved changes). */
	getDisplayText() {
		return getDisplayText(this);
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
			this.wrapper.content = state.content;
			this.initialContent = state.content;

			// If the view is already loaded, update the editor immediately
			if (this.wrapper.targetEl) {
				this.setContent(state.content);
			}
		}
	}

	/** Set editor content if different (for view sync). */
	setContent(content: string) {
		setContent(this, content);
	}

	/** Initialize view on open. */
	async onOpen() {
		// Register this view as active
		this.plugin.contentManager.addActiveView(this);

		// Synchronize content with existing views
		this.synchronizeWithExistingViews();

		// Initialize the inline editor with shared content
		this.wrapper.content = this.plugin.contentManager.sharedNoteContent;
		this.initialContent = this.plugin.contentManager.sharedNoteContent;

		this.plugin.registerEvent(
			this.plugin.app.workspace.on("active-leaf-change", (leaf) => {
				if (leaf?.id === this.leaf.id) {
					this.editor.focus();
				}
			})
		);

		try {
			// Load the inline editor, which relies on private APIs
			await this.wrapper.onload();

			// Create and load the editor container
			const editorContainer = this.contentEl.createEl("div", {
				cls: "sandbox-note-container",
			});
			this.wrapper.load(editorContainer);
			this.loadContent();

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
		synchronizeWithExistingViews(this);
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
				this.wrapper.virtualEditor.editMode
			)
		);
	}

	/** Connect watch editor plugin for sync. */
	private connectEditorPlugin() {
		if (!this.editor) return;

		// Delay connection to ensure editor is fully initialized
		this.onloadCallbacks.push(() => {
			const editorPlugin = this.editor.cm.plugin(
				this.plugin.editorManager.watchEditorPlugin
			);
			if (editorPlugin) {
				editorPlugin.connectToPlugin(this.plugin, this);
			}
		});
	}

	onload(): void {
		this.onloadCallbacks.forEach((callback) => callback());
		this.onloadCallbacks = [];
	}

	/** Update action buttons based on unsaved state. */
	updateActionButtons() {
		updateActionButtons(this);
	}

	/** Update unsaved state and refresh title. */
	updateUnsavedState(currentContent: string) {
		// Only track unsaved state when save setting is enabled
		if (!this.plugin.settings.enableSaveNoteContent) {
			this.hasUnsavedChanges = false;
			this.updateActionButtons();
			return;
		}

		const wasUnsaved = this.hasUnsavedChanges;
		this.hasUnsavedChanges = currentContent !== this.initialContent;
		this.updateActionButtons();

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
		this.wrapper.unload();
		this.contentEl.empty();
	}
}
