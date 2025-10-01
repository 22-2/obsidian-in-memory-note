// src/views/internal/AbstractNoteView.ts (修正版)
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
import type { SettingsManager } from "src/managers/SettingsManager";
import type { ViewManager } from "src/managers/ViewManager";
import type { PluginSettings } from "src/settings";
import type { EventEmitter } from "src/utils/EventEmitter";
import { HOT_SANDBOX_ID_PREFIX } from "src/utils/constants";
import { issue2Logger } from "../../special-loggers";
import { MagicalEditorWrapper } from "./MagicalEditorWrapper";
import type { AbstractNoteViewState, ObsidianViewState } from "./types";
import { extractToFileInteraction } from "./utils";

import type { Editor, MarkdownEditView } from "obsidian";
import { handleClick, handleContextMenu } from "src/helpers/clickHandler";

const logger = log.getLogger("AbstractNoteView");

export type Context = {
	getSettings: SettingsManager["getSettings"];
	getActiveView: ViewManager["getActiveView"];
	isLastHotView: ViewManager["isLastHotView"];
	emitter: EventEmitter<AppEvents>;
};

/** Abstract base class for note views with an inline editor. */
export abstract class AbstractNoteView extends ItemView {
	public masterId: string;
	public scope: Scope;
	public wrapper: MagicalEditorWrapper;
	public navigation = true;

	private stateManager: ViewStateManager;
	private saveManager: SaveManager;
	private eventHandler: ViewEventHandler;

	public get pluginSettings(): PluginSettings {
		return this.context.getSettings();
	}

	constructor(leaf: WorkspaceLeaf, protected context: Context) {
		super(leaf);
		// Ensure masterId is initialized.
		this.masterId = `${HOT_SANDBOX_ID_PREFIX}-${nanoid()}`;
		this.wrapper = new MagicalEditorWrapper({
			emitter: this.context.emitter,
			getActiveView: this.context.getActiveView,
			parentView: this,
			workspace: this.app.workspace as never,
		});
		this.scope = new Scope(this.app.scope);

		this.stateManager = new ViewStateManager();
		this.saveManager = new SaveManager(this.context.emitter, () => this);
		this.eventHandler = new ViewEventHandler(
			this.context.emitter,
			() => this.editor,
			() => this.wrapper.magicalEditor?.editMode
		);
	}

	public get editor() {
		return this.wrapper.magicalEditor?.editor;
	}

	protected get hasUnsavedChanges(): boolean {
		return this.getContent() !== "";
	}

	public get saving(): Promise<void> | null {
		return this.saveManager.saving;
	}

	public abstract getBaseTitle(): string;
	public abstract getContent(): string;
	public abstract getIcon(): string;
	public abstract getViewType(): string;

	save(): void {
		this.saveManager.save(this.masterId);
	}

	public override getDisplayText(): string {
		const baseTitle = this.getBaseTitle();
		const shouldShowUnsaved = this.hasUnsavedChanges;
		return shouldShowUnsaved ? `*${baseTitle}` : baseTitle;
	}

	public override getState(): AbstractNoteViewState {
		const baseState =
			this.wrapper.magicalEditor.getState() as ObsidianViewState;
		const content = this.editor?.getValue() ?? "";
		return this.stateManager.buildState(
			this.getViewType(),
			content,
			this.masterId,
			baseState
		);
	}

	public override async onOpen() {
		logger.debug("AbstractNoteView.onOpen", { masterId: this.masterId });
		try {
			await this.initializeEditor();
			this.setupEventHandlers();
			this.emitOpenEvents();
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

		// Update only when restoring masterId from state.
		if (state?.state?.masterId) {
			this.masterId = state.state.masterId;
			logger.debug(`Restored masterId: ${this.masterId}`);
		}

		const editMode = this.wrapper.magicalEditor?.editMode;

		// update sourceModde
		if (
			typeof state.source === "boolean" &&
			editMode.sourceMode !== state.source
		) {
			editMode.toggleSource();
			state.layout = true;
		}

		if (this.editor && state.state?.content != null) {
			this.setContent(state.state.content);
			await this.wrapper.magicalEditor.setState(state, result);
			// @ts-ignore
			result.close = false;
		}

		// save initial state
		this.stateManager.setInitialState(state);

		await super.setState(state, result);

		logger.debug("setState completed", {
			masterId: this.masterId,
			state,
			result,
		});
	}

	public override onPaneMenu(
		menu: Menu,
		source: "more-options" | "tab-header" | string
	) {
		this.addConvertToFileMenuItem(menu);
		this.addClearContentMenuItem(menu);
		super.onPaneMenu(menu, source);
	}

	public setContent(content: string) {
		if (this.editor && this.editor.getValue() !== content) {
			this.editor.setValue(content);
		}
	}

	private async initializeEditor() {
		const initialState = this.stateManager.getInitialState();
		await this.wrapper.initialize(this.contentEl, initialState);
		this.stateManager.clearInitialState();
	}

	private emitOpenEvents() {
		this.context.emitter.emit("connect-editor-plugin", { view: this });
		this.context.emitter.emit("view-opened", { view: this });
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
		if (!this.editor) {
			logger.error("Editor not found");
			return;
		}

		this.eventHandler.setupObsidianLeafListener(this.leaf.id, (cleanup) =>
			this.register(cleanup)
		);

		this.eventHandler.setupDomEventListeners(
			this.contentEl,
			(el, type, callback) =>
				this.registerDomEvent(
					el,
					type as keyof HTMLElementEventMap,
					callback
				)
		);
	}

	private addConvertToFileMenuItem(menu: Menu) {
		menu.addItem((item) =>
			item
				.setTitle("Convert to file")
				.setIcon("file-pen-line")
				.onClick(async () => {
					await extractToFileInteraction(this);
				})
		);
	}

	private addClearContentMenuItem(menu: Menu) {
		menu.addItem((item) =>
			item
				.setTitle("Clear content")
				.setIcon("trash")
				.setWarning(true)
				.onClick(() => {
					this.setContent("");
				})
		);
	}
}

export class ViewStateManager {
	private initialState: AbstractNoteViewState | null = null;

	setInitialState(state: AbstractNoteViewState | null) {
		this.initialState = state;
	}

	getInitialState(): AbstractNoteViewState | null {
		return this.initialState;
	}

	clearInitialState() {
		this.initialState = null;
	}

	buildState(
		viewType: string,
		content: string,
		masterId: string,
		baseState: any
	): AbstractNoteViewState {
		const state: AbstractNoteViewState = {
			...baseState,
			type: viewType,
			state: {
				masterId,
				content,
			},
		};
		logger.debug("ViewStateManager.buildState", state);
		return state;
	}
}

export class SaveManager {
	private savingPromise: Promise<void> | null = null;

	constructor(
		private emitter: EventEmitter<AppEvents>,
		private getView: () => any
	) {}

	get isSaving(): boolean {
		return this.savingPromise !== null;
	}

	get saving(): Promise<void> | null {
		return this.savingPromise;
	}

	async save(masterId: string): Promise<void> {
		if (this.savingPromise) {
			logger.debug("Save already in progress");
			return this.savingPromise;
		}

		const { promise, resolve, reject } = Promise.withResolvers<void>();
		this.savingPromise = promise;

		const view = this.getView();
		this.emitter.emit("save-requested", { view });

		this.emitter.once("save-result", (payload) => {
			if (payload.view === view) {
				logger.debug("Save completed for view", masterId);
				if (payload.success) {
					resolve();
				} else {
					reject();
				}
				this.savingPromise = null;
			}
		});

		return promise;
	}
}

export class ViewEventHandler {
	constructor(
		private emitter: EventEmitter<AppEvents>,
		private getEditor: () => Editor | undefined,
		private getEditMode: () => MarkdownEditView | undefined
	) {}

	setupObsidianLeafListener(
		leafId: string,
		registerCallback: (cleanup: () => void) => void
	) {
		const handler = (payload: any) => {
			if (payload?.view?.leaf?.id === leafId) {
				this.getEditor()?.focus();
			}
		};

		this.emitter.on("obsidian-active-leaf-changed", handler);
		registerCallback(() => {
			this.emitter.off("obsidian-active-leaf-changed", handler);
		});
	}

	setupDomEventListeners(
		contentEl: HTMLElement,
		registerDomEvent: (
			el: HTMLElement,
			type: string,
			callback: (e: Event) => void
		) => void
	) {
		const editor = this.getEditor();
		if (!editor) {
			logger.error("Editor not found");
			return;
		}

		registerDomEvent(contentEl, "mousedown", (e) =>
			handleClick(e as PointerEvent, editor)
		);

		registerDomEvent(contentEl, "contextmenu", (e) => {
			const editMode = this.getEditMode();
			if (editMode) {
				handleContextMenu(e as PointerEvent, editMode);
			}
		});
	}
}

export type { Context as AbstractNoteViewContext };
