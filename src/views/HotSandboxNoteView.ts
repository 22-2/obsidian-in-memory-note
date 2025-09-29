// src/views/HotSandboxNoteView.ts
import log from "loglevel";
import { WorkspaceLeaf } from "obsidian";
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
		let groupCount = this.context.indexOfMasterId(this.masterNoteId ?? "");
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

	get hasUnsavedChanges(): boolean {
		return this.getContent() != "";
	}

	save(): void {
		if (!this.masterNoteId) return;
		this.context.emitter.emit("save-requested", {
			view: this,
		});
	}

	getContent(): string {
		return this.editor?.getValue() ?? "";
	}

	updateActionButtons() {
		// No-op
	}
}
