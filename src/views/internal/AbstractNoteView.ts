// src/views/internal/AbstractNoteView.ts
import {
	ItemView,
	Menu,
	Scope,
	type ViewStateResult,
	WorkspaceLeaf,
} from "obsidian";

import log from "loglevel";
import { nanoid } from "nanoid";
import type { AppEvents } from "src/events/AppEvents";
import { handleClick, handleContextMenu } from "src/helpers/clickHandler";
import type { AppOrchestrator } from "src/managers/AppOrchestrator";
import { HOT_SANDBOX_ID_PREFIX } from "src/utils/constants";
import type { EventEmitter } from "src/utils/EventEmitter";
import { issue2Logger } from "../../special-loggers";
import { EditorWrapper } from "./EditorWrapper";
import type { AbstractNoteViewState, ObsidianViewState } from "./types";
import { convertToFileAndClear } from "./utils";
import { showConfirmModal } from "../../helpers/showConfirmModal";

const logger = log.getLogger("AbstractNoteView");

export type AbstractNoteViewFuncs = {
	indexOfMasterId: (masterNoteId: string) => number;
	isLastHotView: (masterNoteId: string) => boolean;
};

/** Abstract base class for note views with an inline editor. */
export abstract class AbstractNoteView extends ItemView {
	private initialState: AbstractNoteViewState | null = null;
	private saveActionEl!: HTMLElement;
	public isSourceMode = true;
	public masterNoteId: string | null = null;
	public scope: Scope;
	public wrapper: EditorWrapper;

	public navigation = true;

	constructor(
		leaf: WorkspaceLeaf,
		protected emitter: EventEmitter<AppEvents>,
		protected stateManager: AppOrchestrator,
		protected funcs: AbstractNoteViewFuncs
	) {
		super(leaf);
		this.wrapper = new EditorWrapper(this);
		this.scope = new Scope(this.app.scope);
	}

	public get editor() {
		return this.wrapper.virtualEditor?.editor;
	}

	protected abstract get hasUnsavedChanges(): boolean;
	public abstract getBaseTitle(): string;
	public abstract getContent(): string;
	public abstract getIcon(): string;
	public abstract getViewType(): string;
	public abstract save(): void;

	public override getDisplayText(): string {
		const baseTitle = this.getBaseTitle();
		const shouldShowUnsaved = this.hasUnsavedChanges;
		return shouldShowUnsaved ? `*${baseTitle}` : baseTitle;
	}

	public override getState(): AbstractNoteViewState {
		const state: AbstractNoteViewState = {
			...(super.getState() as ObsidianViewState),
			type: this.getViewType(),
			state: {
				masterNoteId: "",
				content: "",
			},
		};

		state.state.content = (this.editor && this.editor.getValue()) ?? "";
		state.state.masterNoteId = this.masterNoteId ?? "";
		state.source = this.isSourceMode;
		return state;
	}

	public override async onOpen() {
		issue2Logger.debug("AbstractNoteView.onOpen");
		try {
			if (!this.masterNoteId) {
				issue2Logger.debug(
					"masterNoteId not set, creating a new one in onOpen."
				);
				this.masterNoteId = `${HOT_SANDBOX_ID_PREFIX}-${nanoid()}`;
			}
			issue2Logger.debug("masterNoteId", this.masterNoteId);

			await this.wrapper.initialize(this.contentEl, this.initialState);
			this.initialState = null;
			this.setupEventHandlers();
			this.emitter.emit("connect-editor-plugin", { view: this });
			this.emitter.emit("view-opened", { view: this });
		} catch (error) {
			this.handleInitializationError(error);
		}
	}

	public override async onClose() {
		this.emitter.emit("view-closed", { view: this });
		this.wrapper.unload();
		this.contentEl.empty();
	}

	public override async setState(
		state: AbstractNoteViewState,
		result: ViewStateResult
	): Promise<void> {
		issue2Logger.debug("AbstractNoteView.setState state", state);
		const masterIdFromState = state?.state?.masterNoteId;
		if (masterIdFromState) {
			this.masterNoteId = masterIdFromState;
			logger.debug(`Restored note group ID: ${this.masterNoteId}`);
		} else if (!this.masterNoteId) {
			return logger.error("masterNoteId not found in state.");
		}

		if (typeof state.source === "boolean") {
			this.isSourceMode = state.source;
		}

		this.initialState = state;
		if (this.editor && state.state?.content != null) {
			this.setContent(state.state.content);
			await this.wrapper.virtualEditor.setState(state, result);
			// @ts-ignore
			result.close = false;
		}
		logger.debug("setState.state", state);
		logger.debug("setState.result", result);
		await super.setState(state, result);
	}

	public override onPaneMenu(
		menu: Menu,
		source: "more-options" | "tab-header" | string
	) {
		menu.addItem((item) =>
			item
				.setTitle("Convert to file")
				.setIcon("file-pen-line")
				.onClick(async () => {
					await convertToFileAndClear(this);
				})
		).addItem((item) =>
			item
				.setTitle("Clear content")
				.setIcon("trash")
				.setWarning(true)
				.onClick(() => {
					this.setContent("");
				})
		);
		super.onPaneMenu(menu, source);
	}

	public setContent(content: string) {
		if (this.editor && this.editor.getValue() !== content) {
			this.editor.setValue(content);
		}
	}

	private handleInitializationError(error: unknown) {
		logger.error(
			"Sandbox Note: Failed to initialize inline editor.",
			error
		);
		this.contentEl.empty();
		this.contentEl.createEl("div", {
			text: "Error: Could not initialize editor. This might be due to an Obsidian update.",
			cls: "sandbox-error-message",
		});
	}
	private setupEventHandlers() {
		if (!this.editor) return logger.error("Editor not found");

		this.emitter.on("obsidian-active-leaf-changed", (payload) => {
			if (payload?.view?.leaf?.id === this.leaf.id) {
				this.editor?.focus();
			}
		});

		this.registerDomEvent(this.contentEl, "mousedown", (e) =>
			handleClick(e, this.editor)
		);
		this.registerDomEvent(this.contentEl, "contextmenu", (e) =>
			handleContextMenu(e, this.wrapper.virtualEditor.editMode)
		);

		this.scope.register(["Mod"], "w", async () => {
			if (!this.masterNoteId) {
				logger.error(
					"invalid masterNoteId in HotSandboxNoteView.close()"
				);
				return;
			}

			const isLastView = this.funcs.isLastHotView(this.masterNoteId);
			if (!isLastView) {
				return this.leaf.detach();
			}

			const confirmed = await showConfirmModal(
				this.app,
				"Delete Sandbox",
				"Are you sure you want to delete this sandbox?"
			);
			if (confirmed) {
				this.leaf.detach();
				this.emitter.emit("delete-requested", { view: this });
				logger.debug(
					`Deleting hot sandbox note content for group: ${this.masterNoteId}`
				);
				return;
			}
			// User cancelled, but the tab will still close.
			// The data remains in the DB for the next session.
			logger.debug(
				`User cancelled deletion for hot sandbox note: ${this.masterNoteId}`
			);
		});
		this.scope.register(["Mod"], "s", (e: KeyboardEvent) => {
			const activeView = this.app.workspace.activeLeaf?.view;
			if (activeView !== this || !this.editor?.hasFocus()) {
				return true; // Continue with default behavior
			}

			if (this.stateManager.getSettings().enableCtrlS) {
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

	public updateActionButtons() {
		const settings = this.stateManager.getSettings(); // 変更
		if (!settings.enableAutoSave) {
			this.saveActionEl?.hide();
			return;
		}

		if (!this.saveActionEl) {
			this.saveActionEl = this.addAction("save", "Save", () =>
				this.save()
			);
		}
		this.saveActionEl?.show();

		const shouldShowUnsaved =
			settings.enableAutoSave && this.hasUnsavedChanges;

		this.saveActionEl?.toggleClass("is-disabled", !shouldShowUnsaved);
		this.saveActionEl?.setAttribute(
			"aria-disabled",
			String(!shouldShowUnsaved)
		);
	}
}
