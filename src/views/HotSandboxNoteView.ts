// src/views/HotSandboxNoteView.ts
import log from "loglevel";
import { Notice, WorkspaceLeaf } from "obsidian";
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
			// 1. Initial check: masterId must be present.
			if (!this.masterId) {
				logger.error(
					"Invalid masterId. Aborting HotSandboxNoteView closing process."
				);
				return;
			}

			// 2. Early Exit: If data persistence is not threatened.
			// Close the tab immediately if:
			// a) No unsaved changes exist, OR
			// b) Changes exist, but this is not the last active view (data persists elsewhere/DB).
			if (
				!this.hasUnsavedChanges ||
				!this.context.isLastHotView(this.masterId)
			) {
				return this.leaf.detach();
			}

			// --- 3. Deletion Confirmation: This is the last view with unsaved changes. ---

			const confirmed = await showConfirmModal(
				this.app,
				"Delete Sandbox",
				"This sandbox has unsaved changes. Are you sure you want to permanently delete it?"
			);

			if (confirmed) {
				// User confirmed deletion. Request context to delete data.
				this.context.emitter.emit("delete-requested", { view: this });
				logger.debug(
					`Hot sandbox content deletion requested (Group: ${this.masterId})`
				);
			} else {
				// User cancelled. The view closes, but data remains in the DB.
				logger.debug(
					`User cancelled deletion (Group: ${this.masterId}). Data will be retained.`
				);
			}

			// Prevent undo history restoration for hot sandboxes
			this.setContent("");
			// Close the view (tab) regardless of the confirmation result.
			this.leaf.detach();
			return;
		});
		this.scope.register(["Mod"], "s", (e: KeyboardEvent) => {
			const activeView = this.app.workspace.activeLeaf?.view;
			if (activeView !== this || !this.editor?.hasFocus()) {
				return true; // Continue with default behavior
			}

			new Notice("not implmented yet");

			// if (this.context.getSettings().enableCtrlS) {
			// 	// 変更
			// 	e.preventDefault();
			// 	e.stopPropagation();
			// 	logger.debug("Saving note via Ctrl+S");
			// 	this.save();
			// 	return false; // Prevent default save action
			// }
			// return true;
		});
	}
}
