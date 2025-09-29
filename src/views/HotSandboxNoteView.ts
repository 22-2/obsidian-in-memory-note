// src/views/HotSandboxNoteView.ts
import log from "loglevel";
import { WorkspaceLeaf } from "obsidian";
import { showConfirmModal } from "src/helpers/showConfirmModal";
import type { ViewManager } from "src/managers/ViewManager";
import {
	HOT_SANDBOX_NOTE_ICON,
	VIEW_TYPE_HOT_SANDBOX,
} from "src/utils/constants";
import {
	AbstractNoteView,
	type AbstractNoteViewContext,
} from "./internal/AbstractNoteView";

const logger = log.getLogger("HotSandboxNoteView");

type Context = AbstractNoteViewContext & {
	indexOfMasterId: ViewManager["indexOfMasterId"];
};

export class HotSandboxNoteView extends AbstractNoteView {
	constructor(leaf: WorkspaceLeaf, protected context: Context) {
		super(leaf, context);
	}

	getViewType(): string {
		return VIEW_TYPE_HOT_SANDBOX;
	}

	getBaseTitle(): string {
		let groupCount = this.context.indexOfMasterId(this.masterId ?? "");
		// logger.debug("groupCount", groupCount);
		if (groupCount === -1) {
			groupCount = 0;
			// logger.debug("initial 1 added", groupCount);
		}
		const displayNumber = groupCount + 1;
		// logger.debug("displayNumber", displayNumber);
		return `Hot Sandbox-${displayNumber}`;
	}

	getIcon(): string {
		return HOT_SANDBOX_NOTE_ICON;
	}

	getContent(): string {
		return this.editor?.getValue() ?? "";
	}

	protected override setupEventHandlers() {
		super.setupEventHandlers();

		this.scope.register(["Mod"], "w", async () => {
			if (!this.masterId) {
				logger.error(
					"invalid masterNoteId in HotSandboxNoteView.close()"
				);
				return;
			}
			if (!this.hasUnsavedChanges) {
				return this.leaf.detach();
			}

			if (!this.context.isLastHotView(this.masterId)) {
				return this.leaf.detach();
			}

			const confirmed = await showConfirmModal(
				this.app,
				"Delete Sandbox",
				"Are you sure you want to delete this sandbox?"
			);
			if (confirmed) {
				this.leaf.detach();
				this.context.emitter.emit("delete-requested", { view: this });
				logger.debug(
					`Deleting hot sandbox note content for group: ${this.masterId}`
				);
				return;
			}
			// User cancelled, but the tab will still close.
			// The data remains in the DB for the next session.
			logger.debug(
				`User cancelled deletion for hot sandbox note: ${this.masterId}`
			);
		});
		this.scope.register(["Mod"], "s", (e: KeyboardEvent) => {
			const activeView = this.app.workspace.activeLeaf?.view;
			if (activeView !== this || !this.editor?.hasFocus()) {
				return true; // Continue with default behavior
			}

			if (this.context.getSettings().enableCtrlS) {
				// 変更
				e.preventDefault();
				e.stopPropagation();
				logger.debug("Saving note via Ctrl+S");
				this.save();
				return false; // Prevent default save action
			}
			return true;
		});
	}
}
