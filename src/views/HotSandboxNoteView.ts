// src/views/HotSandboxNoteView.ts
import log from "loglevel";
import { WorkspaceLeaf } from "obsidian";
import { showConfirmModal } from "src/helpers/interaction";
import type { DatabaseManager } from "src/managers/DatabaseManager";
import type { ViewManager } from "src/managers/ViewManager";
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
	getActiveView: ViewManager["getActiveView"];
};

export class HotSandboxNoteView extends AbstractNoteView {
	constructor(leaf: WorkspaceLeaf, protected context: Context) {
		super(leaf, context);
	}

	getViewType(): string {
		return VIEW_TYPE_HOT_SANDBOX;
	}

	getBaseTitle(): string {
		const defaultTitle = `Hot Sandbox-${this.context.getDisplayIndex(
			this.masterId!
		)}`;

		if (!this.context.getSettings().firstLineAsTitle) {
			return defaultTitle;
		}

		const content = this.getContent();

		// Get the first line of content and trim whitespace.
		const firstLine = content.split("\n")[0].trim();

		// Return the first line as the title if it contains content.
		if (firstLine.length > 0) {
			return firstLine;
		}

		return defaultTitle;
	}

	getIcon(): string {
		return HOT_SANDBOX_NOTE_ICON;
	}

	getContent(): string {
		return this.editor?.getValue() ?? "";
	}

	/**
	 * Handle close request (Ctrl+W)
	 */
	async shouldClose(): Promise<boolean> {
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
	async handleSaveRequest(
		{
			force = false,
			saveToVault = false,
		}: { force?: boolean; saveToVault?: boolean } = {
			force: false,
			saveToVault: false,
		}
	): Promise<void> {
		// Only save if this view has focus
		const activeView = this.context.getActiveView();
		if (activeView?.leaf.id !== this.leaf.id || !this.editor?.hasFocus()) {
			return;
		}

		if (!saveToVault) {
			this.save();
			return;
		}

		if (!force) {
			// save if there are unsaved changes
			if (!this.hasUnsavedChanges) {
				return;
			}
		}

		if (await extractToFileInteraction(this)) {
			this.context.deleteFromAll(this.masterId);
		}
	}
}
