// src/views/HotSandboxNoteView.ts
import { nanoid } from "nanoid";
import { WorkspaceLeaf } from "obsidian";
import {
	HOT_SANDBOX_NOTE_ICON,
	HOT_SANDBOX_ID_PREFIX,
	VIEW_TYPE_HOT_SANDBOX,
} from "src/utils/constants";
import type SandboxNotePlugin from "../main";
import { AbstractNoteView } from "./internal/AbstractNoteView";
import log from "loglevel";

export class HotSandboxNoteView extends AbstractNoteView {
	constructor(leaf: WorkspaceLeaf, plugin: SandboxNotePlugin) {
		super(leaf, plugin);
	}

	getViewType(): string {
		return VIEW_TYPE_HOT_SANDBOX;
	}

	getBaseTitle(): string {
		const groupCount = this.plugin.editorSyncManager.getGroupNumber(
			this.noteGroupId ?? ""
		);
		return `Hot Sandbox-${groupCount}`;
	}

	getIcon(): string {
		return HOT_SANDBOX_NOTE_ICON;
	}

	get hasUnsavedChanges(): boolean {
		if (!this.noteGroupId) return false;
		return this.getContent() !== "";
	}

	save(): void {
		if (!this.noteGroupId) return;
		this.plugin.emitter.emit("save-requested", {
			view: this,
		});
	}

	getContent(): string {
		if (!this.editor) {
			return this.plugin.editorSyncManager.getHotNoteContent(
				this.noteGroupId ?? ""
			);
		}
		return this.editor.getValue();
	}

	async onOpen() {
		this.plugin.editorSyncManager.addHotActiveView(this);
		await super.onOpen();
	}

	async onClose() {
		this.plugin.editorSyncManager.removeHotActiveView(this);
		await super.onClose();
	}

	updateActionButtons() {
		// No-op
	}
}
