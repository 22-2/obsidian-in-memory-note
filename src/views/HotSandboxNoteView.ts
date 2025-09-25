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
		// Per specification, show asterisk if content is not empty.
		return this.getContent() !== "";
	}

	async loadInitialContent(): Promise<string> {
		if (!this.noteGroupId) return "";
		return this.plugin.editorSyncManager.getHotNoteContent(
			this.noteGroupId
		);
	}

	async save(): Promise<void> {
		if (!this.noteGroupId) return;
		this.plugin.emitter.emit("save-requested", {
			view: this,
			noteGroupId: this.noteGroupId,
			content: this.getContent(),
		});
	}

	getContent(): string {
		if (!this.editor) {
			// Fallback if editor is not ready, though this should be rare.
			return this.plugin.editorSyncManager.getHotNoteContent(
				this.noteGroupId ?? ""
			);
		}
		return this.editor.getValue();
	}

	async onOpen() {
		// noteGroupId の復元・生成は setState で行われるため、ここでの処理は不要です。
		// このビューがアクティブになったことをマネージャーに登録します。
		this.plugin.editorSyncManager.addHotActiveView(this);

		// 親の onOpen を呼び出してエディタを初期化します。
		// この中で loadInitialContent が呼ばれるため、正しい noteGroupId でコンテンツがロードされます。
		await super.onOpen();
	}

	async handleSaveRequest(): Promise<void> {
		log.debug("not implmented");
	}

	async onClose() {
		// if (!this.noteGroupId) {
		// 	log.error("invalid noteGroupId in HotSandboxNoteView.close()");
		// 	new Notice("Invalid noteGroupId in HotSandboxNoteView.close()");
		// 	return;
		// }

		// const isLastView = this.plugin.editorSyncManager.isLastHotView(this);
		// if (isLastView) {
		// 	const confirmed = await showConfirmModal(
		// 		this.app,
		// 		"Delete Sandbox",
		// 		"Are you sure you want to delete this sandbox?"
		// 	);
		// 	if (confirmed) {
		// 		log.debug(
		// 			`Deleting hot sandbox note content for group: ${this.noteGroupId}`
		// 		);
		// 		await this.plugin.databaseManager.deleteNote(this.noteGroupId);
		// 		this.plugin.editorSyncManager.clearHotNoteData(
		// 			this.noteGroupId
		// 		);
		// 	} else {
		// 		// User cancelled, but the tab will still close.
		// 		// The data remains in the DB for the next session.
		// 		log.debug(
		// 			`User cancelled deletion for hot sandbox note: ${this.noteGroupId}`
		// 		);
		// 	}
		// }

		this.plugin.editorSyncManager.removeHotActiveView(this);
		await super.onClose();
	}

	// HotSandboxNoteView doesn't need the save button in the header,
	// as saving is fully automatic.
	updateActionButtons() {
		// No-op
	}
}
