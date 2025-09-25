// E:\Desktop\coding\pub\obsidian-sandbox-note\src\views\SandboxNoteView.ts
import { WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_SANDBOX } from "src/utils/constants";
import type SandboxNotePlugin from "../main";
import { AbstractNoteView } from "./internal/AbstractNoteView";

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

	/** Returns whether this view has unsaved changes. */
	get hasUnsavedChanges(): boolean {
		return this.plugin.editorSyncManager.hasUnsavedChanges;
	}

	/** Load content from the shared ContentManager and synchronize. */
	async loadInitialContent(): Promise<string> {
		return this.plugin.editorSyncManager.currentSharedNoteContent;
	}

	/** Save the content using the SaveManager. */
	async save(): Promise<void> {
		await this.plugin.saveManager.saveNoteContentToFile(this);
	}

	/** On open, register this view with the ContentManager. */
	async onOpen() {
		this.plugin.editorSyncManager.addActiveView(this);
		this.syncViewContent();
		this.syncActiveEditorState();
		await super.onOpen();
	}

	/** On close, unregister this view. */
	async onClose() {
		this.plugin.editorSyncManager.removeActiveView(this);
		await super.onClose();
	}

	/** Synchronize the content of this view with the shared content. */
	private syncViewContent() {
		const initialContent =
			this.plugin.editorSyncManager.currentSharedNoteContent;
		if (initialContent) {
			this.setContent(initialContent);
		}
	}

	getContent(): string {
		return this.plugin.editorSyncManager.currentSharedNoteContent;
	}

	/**
	 * Syncs Obsidian's internal active editor state with our virtual editor.
	 * This ensures that commands and other editor features work correctly.
	 */
	syncActiveEditorState(): void {
		const activeView =
			this.app.workspace.getActiveViewOfType(SandboxNoteView);
		// @ts-ignore - Accessing a private API to manage the active editor.
		const workspace = this.app.workspace;

		// If the active view is our sandbox view, set its virtual editor as active.
		if (activeView instanceof AbstractNoteView && activeView.editor) {
			workspace._activeEditor = activeView.wrapper.virtualEditor;
		}
		// If the active editor was ours, but the view is no longer a sandbox view...
		else if (
			// @ts-expect-error
			workspace._activeEditor?.leaf?.__FAKE_LEAF__ &&
			!(activeView instanceof AbstractNoteView)
		) {
			// ...clear it to avoid side effects on regular notes.
			workspace._activeEditor = null;
		}
	}
}
