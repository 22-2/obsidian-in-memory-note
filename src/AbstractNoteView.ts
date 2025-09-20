import { ItemView, WorkspaceLeaf } from "obsidian";
import { handleClick, handleContextMenu } from "src/click-handler";
import { EditorWrapper } from "src/editorWrapper";
import type SandboxNotePlugin from "./main";
import { getDisplayText, updateActionButtons } from "./viewHelpers";
import { setContent } from "./viewSync";
import { SANDBOX_NOTE_ICON } from "./utils/constants";

/** Abstract base class for note views with an inline editor. */
export abstract class AbstractNoteView extends ItemView {
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

	// Methods to be implemented by subclasses
	abstract getViewType(): string;
	abstract loadInitialContent(): Promise<string>;
	abstract save(): Promise<void>;
	onContentChanged(content: string): void {
		// Default implementation does nothing.
		// Subclasses can override this to react to content changes.
	}

	abstract getBaseTitle(): string;

	/** Get display text for tab (shows * for unsaved changes). */
	getDisplayText(): string {
		const baseTitle = this.getBaseTitle();
		const shouldShowUnsaved =
			this.plugin.settings.enableSaveNoteContent && this.hasUnsavedChanges;
		return shouldShowUnsaved ? `*${baseTitle}` : baseTitle;
	}

	/** Get view icon. */
	getIcon() {
		return SANDBOX_NOTE_ICON;
	}

	/** Set editor content if different from the provided content. */
	setContent(content: string) {
		setContent(this, content);
	}

	/** Initialize view on open. */
	async onOpen() {
		this.plugin.registerEvent(
			this.plugin.app.workspace.on("active-leaf-change", (leaf) => {
				if (leaf?.id === this.leaf.id) {
					this.editor?.focus();
				}
			}),
		);

		try {
			// Load the inline editor, which relies on private APIs
			await this.wrapper.onload();

			// Create and load the editor container
			const editorContainer = this.contentEl.createEl("div", {
				cls: "sandbox-note-container",
			});
			this.wrapper.load(editorContainer);

			// Load initial content and set up the editor
			const initialContent = await this.loadInitialContent();
			this.initialContent = initialContent;
			this.wrapper.content = initialContent;
			this.setContent(initialContent);

			// Set up event handlers and editor plugin connection
			this.setupEventHandlers();
			this.connectEditorPlugin();
		} catch (error) {
			console.error("Sandbox Note: Failed to initialize inline editor.", error);
			// Display an error message to the user
			this.contentEl.empty();
			this.contentEl.createEl("div", {
				text: "Error: Could not initialize editor. This might be due to an Obsidian update.",
				cls: "sandbox-error-message",
			});
		}
	}

	/** Setup DOM event handlers. */
	private setupEventHandlers() {
		if (!this.editor) return;

		this.registerDomEvent(
			this.contentEl,
			"mousedown",
			handleClick.bind(null, this.editor),
		);

		this.registerDomEvent(
			this.contentEl,
			"contextmenu",
			handleContextMenu.bind(
				null,
				this.app.commands,
				this.wrapper.virtualEditor.editMode,
			),
		);
	}

	/** Connect watch editor plugin for sync. */
	private connectEditorPlugin() {
		if (!this.editor) return;

		// Delay connection to ensure editor is fully initialized
		this.onloadCallbacks.push(() => {
			const editorPlugin = this.editor.cm.plugin(
				this.plugin.editorManager.watchEditorPlugin,
			);
			if (editorPlugin) {
				// We are casting `this` to `any` because the plugin expects a concrete view type
				// but the core logic is the same.
				editorPlugin.connectToPlugin(this.plugin, this as any);
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
		this.wrapper.unload();
		this.contentEl.empty();
	}
}
