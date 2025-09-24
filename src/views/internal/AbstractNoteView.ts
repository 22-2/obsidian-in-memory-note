// E:\Desktop\coding\pub\obsidian-sandbox-note\src\views\helpers\AbstractNoteView.ts
import {
	ItemView,
	MarkdownView,
	Notice,
	type ViewStateResult,
	WorkspaceLeaf,
} from "obsidian";

import log from "loglevel";
import {
	handleClick,
	handleContextMenu,
	handleKeyDown,
} from "src/helpers/clickHandler";
import { setContent } from "src/helpers/viewSync";
import type SandboxNotePlugin from "src/main";
import { SANDBOX_NOTE_ICON } from "src/utils/constants";
import { EditorWrapper } from "./EditorWrapper";

/** Abstract base class for note views with an inline editor. */
export abstract class AbstractNoteView extends ItemView {
	plugin: SandboxNotePlugin;
	public wrapper: EditorWrapper;
	saveActionEl!: HTMLElement;
	private initialState: any = null;
	public isSourceMode = true;

	navigation = true;

	constructor(leaf: WorkspaceLeaf, plugin: SandboxNotePlugin) {
		super(leaf);
		this.plugin = plugin;
		this.wrapper = new EditorWrapper(this);
	}

	get editor() {
		return this.wrapper.virtualEditor?.editor;
	}

	abstract getViewType(): string;
	abstract loadInitialContent(): Promise<string>;
	abstract save(): Promise<void>;
	abstract getBaseTitle(): string;
	abstract get hasUnsavedChanges(): boolean;

	getDisplayText(): string {
		const baseTitle = this.getBaseTitle();
		const shouldShowUnsaved =
			this.hasUnsavedChanges && Boolean(this.containerEl.isShown?.());
		return shouldShowUnsaved ? `*${baseTitle}` : baseTitle;
	}

	getIcon() {
		return SANDBOX_NOTE_ICON;
	}

	setContent(content: string) {
		setContent(this, content);
	}

	getState(): any {
		const state = super.getState();
		if (this.editor) {
			const editorState = MarkdownView.prototype.getState.call(
				this.wrapper.virtualEditor
			);
			Object.assign(state, editorState);
			state.content = this.editor.getValue();
			state.source = this.isSourceMode;
		} else {
			state.content = this.wrapper.content;
			state.source = this.isSourceMode;
		}
		return state;
	}

	async setState(state: any, result: ViewStateResult): Promise<void> {
		if (typeof state.source === "boolean") {
			this.isSourceMode = state.source;
		}

		this.initialState = state;
		if (this.editor && state.content != null) {
			this.setContent(state.content);
			// The unsaved state is now managed centrally
			await this.wrapper.virtualEditor.setState(state, result);
			// @ts-ignore
			result.close = false; // Prevent the view from being closed and reopened unnecessarily
		}
		await super.setState(state, result);
	}

	async onOpen() {
		// this.applyViewStatePatch();
		this.registerActiveLeafEvents();

		try {
			await this.wrapper.initialize(this.contentEl, this.initialState);
			this.initialState = null;
			this.setupEventHandlers();
			this.plugin.editorPluginConnector.connectEditorPluginToView(this);
		} catch (error) {
			this.handleInitializationError(error);
		}
	}

	private registerActiveLeafEvents() {
		this.plugin.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				if (leaf?.id === this.leaf.id) {
					this.editor?.focus();
				}
			})
		);
	}

	private handleInitializationError(error: unknown) {
		log.error("Sandbox Note: Failed to initialize inline editor.", error);
		new Notice("Sandbox Note: Failed to initialize inline editor.");
		this.contentEl.empty();
		this.contentEl.createEl("div", {
			text: "Error: Could not initialize editor. This might be due to an Obsidian update.",
			cls: "sandbox-error-message",
		});
	}

	private setupEventHandlers() {
		if (!this.editor) return;
		this.registerDomEvent(this.contentEl, "mousedown", (e) =>
			handleClick(e, this.editor)
		);
		this.registerDomEvent(this.contentEl, "contextmenu", (e) =>
			handleContextMenu(e, this.wrapper.virtualEditor.editMode)
		);

		// Use the capture phase to reliably catch the Ctrl+S hotkey, which is otherwise difficult to intercept in Obsidian.
		this.registerDomEvent(
			window,
			"keydown",
			(e) => handleKeyDown(e, this),
			{
				capture: true,
			}
		);
	}

	updateActionButtons() {
		if (!this.plugin.data.settings.enableAutoSave) {
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
			this.plugin.data.settings.enableAutoSave && this.hasUnsavedChanges;

		this.saveActionEl?.toggleClass("is-disabled", !shouldShowUnsaved);
		this.saveActionEl?.setAttribute(
			"aria-disabled",
			String(!shouldShowUnsaved)
		);
	}

	async onClose() {
		this.wrapper.unload();
		this.contentEl.empty();
	}
}
