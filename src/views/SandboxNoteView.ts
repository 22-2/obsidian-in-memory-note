// E:\Desktop\coding\pub\obsidian-sandbox-note\src\views\SandboxNoteView.ts
import { WorkspaceLeaf } from "obsidian";
import { SANDBOX_NOTE_ICON, VIEW_TYPE_SANDBOX } from "src/utils/constants";
import type SandboxNotePlugin from "../main";
import { AbstractNoteView } from "./internal/AbstractNoteView";

/** View for a synchronized, persistent sandbox note. */
export class SandboxNoteView extends AbstractNoteView {
	constructor(leaf: WorkspaceLeaf, plugin: SandboxNotePlugin) {
		super(leaf, plugin);
	}

	getViewType() {
		return VIEW_TYPE_SANDBOX;
	}

	getBaseTitle(): string {
		return "Sandbox Note";
	}

	public getIcon(): string {
		return SANDBOX_NOTE_ICON;
	}

	get hasUnsavedChanges(): boolean {
		return this.plugin.saveManager.hasUnsavedChanges;
	}

	save(): void {
		this.plugin.emitter.emit("save-requested", { view: this });
	}

	async onOpen() {
		this.plugin.editorSyncManager.addActiveView(this);
		this.syncViewContent();
		this.syncActiveEditorState();
		await super.onOpen();
	}

	async onClose() {
		this.plugin.editorSyncManager.removeActiveView(this);
		await super.onClose();
	}

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

	syncActiveEditorState(): void {
		const activeView = this.plugin.getActiveSandboxNoteView();
		// @ts-ignore - Accessing a private API to manage the active editor.
		const workspace = this.app.workspace;

		if (activeView instanceof AbstractNoteView && activeView.editor) {
			workspace._activeEditor = activeView.wrapper.virtualEditor;
		} else if (
			// @ts-expect-error
			workspace._activeEditor?.leaf?.__FAKE_LEAF__ &&
			!(activeView instanceof AbstractNoteView)
		) {
			workspace._activeEditor = null;
		}
	}
}
