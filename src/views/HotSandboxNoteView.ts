// src/views/HotSandboxNoteView.ts
import log from "loglevel";
import { around } from "monkey-around";
import { Plugin, WorkspaceLeaf } from "obsidian";
import { showConfirmModal } from "src/helpers/interaction";
import type { DatabaseManager } from "src/managers/DatabaseManager";
import {
	HOT_SANDBOX_NOTE_ICON,
	VIEW_TYPE_HOT_SANDBOX,
} from "src/utils/constants";
import {
	AbstractNoteView,
	type AbstractNoteViewContext,
} from "./internal/AbstractNoteView";
import { extractToFileInteraction } from "./internal/utils";

const logger = log.getLogger("HotSandboxNoteView");

type Context = AbstractNoteViewContext & {
	getDisplayIndex(masterId: string): number;
	deleteFromAll: DatabaseManager["deleteFromAll"];
	register: Plugin["register"];
};

export class HotSandboxNoteView extends AbstractNoteView {
	constructor(leaf: WorkspaceLeaf, protected context: Context) {
		super(leaf, context);
	}

	getViewType(): string {
		return VIEW_TYPE_HOT_SANDBOX;
	}

	getBaseTitle(): string {
		return `Hot Sandbox-${this.context.getDisplayIndex(this.masterId!)}`;
	}

	getIcon(): string {
		return HOT_SANDBOX_NOTE_ICON;
	}

	getContent(): string {
		return this.editor?.getValue() ?? "";
	}

	protected override setupEventHandlers() {
		super.setupEventHandlers();

		this.context.register(
			around(WorkspaceLeaf.prototype, {
				detach: (orig) =>
					async function (this: WorkspaceLeaf) {
						if (!(this.view instanceof HotSandboxNoteView)) {
							// 通常のViewは普通に閉じる
							return orig.call(this);
						}

						// HotSandboxNoteViewの場合
						let shouldClose = false;

						try {
							shouldClose = await (
								this.view as HotSandboxNoteView
							).shouldClose();
						} catch (error) {
							logger.error("Failed to check shouldClose:", error);
							// エラー時はユーザーに確認を求めることも可能
							// shouldClose = confirm("エラーが発生しました。閉じますか?");
							shouldClose = false; // 安全側に倒す
						}

						if (shouldClose) {
							return orig.call(this);
						}

						// 閉じない場合は何も返さない(undefined)
						console.log("View close prevented by user");
					},
			})
		);

		// Ctrl+S: Save to file
		this.context.register(
			around(WorkspaceLeaf.prototype, {
				save: (orig) =>
					async function (this: WorkspaceLeaf) {
						if (!(this.view instanceof HotSandboxNoteView)) {
							// 通常のViewは普通に保存
							return orig.call(this);
						}
						// HotSandboxNoteViewの場合
						await (
							this.view as HotSandboxNoteView
						).handleSaveRequest();
					},
			})
		);
	}

	/**
	 * Handle close request (Ctrl+W)
	 */
	private async shouldClose(): Promise<boolean> {
		if (!this.masterId) {
			logger.error(
				"Invalid masterId. Aborting HotSandboxNoteView closing process."
			);
			return false;
		}

		if (
			!this.hasUnsavedChanges ||
			!this.context.isLastHotView(this.masterId)
		) {
			return true;
		}

		const confirmed = await showConfirmModal(
			this.app,
			"Delete Sandbox",
			"This sandbox has unsaved changes. Are you sure you want to permanently delete it?"
		);

		if (confirmed) {
			this.context.emitter.emit("delete-requested", { view: this });
			logger.debug(
				`Hot sandbox content deletion requested (Group: ${this.masterId})`
			);
			this.setContent("");
			return true;
		}
		logger.debug(
			`User cancelled deletion (Group: ${this.masterId}). Data will be retained.`
		);
		return false;
	}

	/**
	 * Handle save request (Ctrl+S)
	 */
	private async handleSaveRequest(): Promise<void> {
		// Only save if this view has focus
		const activeView = this.app.workspace.activeLeaf?.view;
		if (activeView !== this || !this.editor?.hasFocus()) {
			return;
		}

		// Only save if there are unsaved changes
		if (!this.hasUnsavedChanges) {
			return;
		}

		if (await extractToFileInteraction(this)) {
			this.context.deleteFromAll(this.masterId);
		}
	}
}
