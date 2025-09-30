// src/views/HotSandboxNoteView.ts
import log from "loglevel";
import { WorkspaceLeaf } from "obsidian";
import { showConfirmModal } from "src/helpers/interaction";
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
		if (groupCount === -1) {
			groupCount = 0;
		}
		const displayNumber = groupCount + 1;
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

		// Ctrl+W: Close with confirmation if unsaved
		this.scope.register(["Mod"], "w", async () => {
			await this.handleCloseRequest();
		});

		// Ctrl+S: Save to file
		this.scope.register(["Mod"], "s", async () => {
			await this.handleSaveRequest();
		});
	}

	/**
	 * Handle close request (Ctrl+W)
	 */
	private async handleCloseRequest(): Promise<void> {
		if (!this.masterId) {
			logger.error(
				"Invalid masterId. Aborting HotSandboxNoteView closing process."
			);
			return;
		}

		if (
			!this.hasUnsavedChanges ||
			!this.context.isLastHotView(this.masterId)
		) {
			return this.leaf.detach();
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
		} else {
			logger.debug(
				`User cancelled deletion (Group: ${this.masterId}). Data will be retained.`
			);
		}

		this.setContent("");
		this.leaf.detach();
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

		await extractToFileInteraction(this);
	}
}
