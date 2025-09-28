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
import type { EventEmitter } from "src/utils/EventEmitter";
import type { AppEvents } from "src/events/AppEvents";
import type { StateManager } from "src/managers/StateManager";

const logger = log.getLogger("HotSandboxNoteView");

export class HotSandboxNoteView extends AbstractNoteView {
	constructor(
		leaf: WorkspaceLeaf,
		protected emitter: EventEmitter<AppEvents>,
		protected stateManager: StateManager,
		private funcs: { indexOfMasterId: (masterId: string) => number }
	) {
		super(leaf, emitter, stateManager);
	}

	getViewType(): string {
		return VIEW_TYPE_HOT_SANDBOX;
	}

	getBaseTitle(): string {
		let groupCount = this.funcs.indexOfMasterId(this.masterNoteId ?? "");
		logger.debug("groupCount", groupCount);
		if (groupCount === -1) {
			groupCount = 0;
			logger.debug("initial 1 added", groupCount);
		}
		const displayNumber = groupCount + 1;
		logger.debug("displayNumber", displayNumber);
		return `Hot Sandbox-${displayNumber}`;
	}

	getIcon(): string {
		return HOT_SANDBOX_NOTE_ICON;
	}

	get hasUnsavedChanges(): boolean {
		if (!this.masterNoteId) return false;
		return this.getContent() !== "";
	}

	save(): void {
		if (!this.masterNoteId) return;
		this.emitter.emit("save-requested", {
			view: this,
		});
	}

	getContent(): string {
		return this.editor?.getValue() ?? "";
	}

	async onOpen() {
		this.emitter.emit("view-opened", { view: this });
		await super.onOpen();
	}

	async onClose() {
		this.emitter.emit("view-closed", { view: this });
		await super.onClose();
	}

	updateActionButtons() {
		// No-op
	}
}
