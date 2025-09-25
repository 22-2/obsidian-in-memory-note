// E:\Desktop\coding\pub\obsidian-sandbox-note\src\views\SandboxNoteView.ts
import { WorkspaceLeaf } from "obsidian";
import { SANDBOX_NOTE_ICON, VIEW_TYPE_SANDBOX } from "src/utils/constants";
import type SandboxNotePlugin from "../main";
import { AbstractNoteView } from "./internal/AbstractNoteView";

/** View for a synchronized, persistent sandbox note. */
export class SandboxNoteView extends AbstractNoteView {
	private _hasUnsavedChanges = false;

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
		return this._hasUnsavedChanges;
	}

	save(): void {
		this.plugin.emitter.emit("save-requested", { view: this });
	}

	async onOpen() {
		this.register(
			this.plugin.emitter.on(
				"unsaved-state-changed",
				this.handleUnsavedStateChange
			)
		);
		this.plugin.emitter.emit("view-opened", { view: this });

		this.syncActiveEditorState();
		await super.onOpen();
	}

	async onClose() {
		this.plugin.emitter.emit("view-closed", { view: this });
		await super.onClose();
	}

	private handleUnsavedStateChange = (payload: {
		hasUnsavedChanges: boolean;
	}) => {
		if (this._hasUnsavedChanges !== payload.hasUnsavedChanges) {
			this._hasUnsavedChanges = payload.hasUnsavedChanges;
			this.leaf.updateHeader();
		}
	};

	getContent(): string {
		return this.editor?.getValue() ?? "";
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
