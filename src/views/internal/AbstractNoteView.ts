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
import type { SettingsManager } from "src/managers/SettingsManager";
import type { ViewManager } from "src/managers/ViewManager";
import type { PluginSettings } from "src/settings"; // Import PluginSettings
import type { EventEmitter } from "src/utils/EventEmitter";
import { HOT_SANDBOX_ID_PREFIX } from "src/utils/constants";
import { issue2Logger } from "../../special-loggers";
import { EditorWrapper } from "./EditorWrapper";
import type { AbstractNoteViewState, ObsidianViewState } from "./types";
import { extractToFileInteraction } from "./utils";

const logger = log.getLogger("AbstractNoteView");

export type Context = {
	getSettings: SettingsManager["getSettings"];
	isLastHotView: ViewManager["isLastHotView"];
	emitter: EventEmitter<AppEvents>;
};

export type { Context as AbstractNoteViewContext };

/** Abstract base class for note views with an inline editor. */
export abstract class AbstractNoteView extends ItemView {
	private initialState: AbstractNoteViewState | null = null;
	private saveActionEl!: HTMLElement;
	public isSourceMode = true;
	public masterId: string | null = null;
	public scope: Scope;
	public wrapper: EditorWrapper;

	public navigation = true;

	// NEW: Getter for plugin settings
	public get pluginSettings(): PluginSettings {
		return this.context.getSettings();
	}

	constructor(
		leaf: WorkspaceLeaf,
		protected context: Context // protected emitter: EventEmitter<AppEvents>, // protected orchestrator: AppOrchestrator, // protected funcs: AbstractNoteViewFuncs
	) {
		super(leaf);
		this.wrapper = new EditorWrapper(this);
		this.scope = new Scope(this.app.scope);
	}

	public get editor() {
		return this.wrapper.virtualEditor?.editor;
	}

	protected get hasUnsavedChanges(): boolean {
		return this.getContent() != "";
	}

	public abstract getBaseTitle(): string;
	public abstract getContent(): string;
	public abstract getIcon(): string;
	public abstract getViewType(): string;

	save(): void {
		if (!this.masterId) return;
		const { promise, resolve, reject } = Promise.withResolvers<void>();
		this.saving = promise;

		this.context.emitter.emit("save-requested", {
			view: this,
		});

		this.context.emitter.once("save-result", (payload) => {
			if (payload.view === this) {
				logger.debug("Save completed for view", this.masterId);
				payload.success ? resolve() : reject();
				this.saving = null;
			}
		});
	}

	saving: null | Promise<void> = null;

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
				masterId: "",
				content: "",
			},
		};
		logger.debug("AbstractNoteView.getState", state);

		state.state.content = (this.editor && this.editor.getValue()) ?? "";
		state.state.masterId = this.masterId ?? "";
		state.source = this.isSourceMode;
		return state;
	}

	public override async onOpen() {
		logger.debug("AbstractNoteView.onOpen");
		try {
			if (!this.masterId) {
				logger.debug("masterId not set, creating a new one in onOpen.");
				this.masterId = `${HOT_SANDBOX_ID_PREFIX}-${nanoid()}`;
			}
			logger.debug("masterId", this.masterId);

			await this.wrapper.initialize(this.contentEl, this.initialState);
			this.initialState = null;
			this.setupEventHandlers();
			this.context.emitter.emit("connect-editor-plugin", { view: this });
			this.context.emitter.emit("view-opened", { view: this });
		} catch (error) {
			this.handleInitializationError(error);
		}
	}

	public override async onClose() {
		this.context.emitter.emit("view-closed", { view: this });
		this.wrapper.unload();
		this.contentEl.empty();
	}

	public override async setState(
		state: AbstractNoteViewState,
		result: ViewStateResult
	): Promise<void> {
		issue2Logger.debug("AbstractNoteView.setState", state);
		const masterIdFromState = state?.state?.masterId;
		if (masterIdFromState) {
			this.masterId = masterIdFromState;
			logger.debug(`Restored note group ID: ${this.masterId}`);
		} else if (!this.masterId) {
			return logger.error("masterId not found in state.");
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
					await extractToFileInteraction(this);
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
	protected setupEventHandlers() {
		if (!this.editor) return logger.error("Editor not found");

		this.context.emitter.on("obsidian-active-leaf-changed", (payload) => {
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
	}
}
