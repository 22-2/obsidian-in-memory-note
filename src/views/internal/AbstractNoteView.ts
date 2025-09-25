// src/views/internal/AbstractNoteView.ts
import {
	ItemView,
	MarkdownView,
	Menu,
	Notice,
	Scope,
	type ViewStateResult,
	WorkspaceLeaf,
} from "obsidian";

import log from "loglevel";
import { nanoid } from "nanoid";
import {
	handleClick,
	handleContextMenu,
	handleKeyDown,
} from "src/helpers/clickHandler";
import type SandboxNotePlugin from "src/main";
import { HOT_SANDBOX_ID_PREFIX, SANDBOX_NOTE_ICON } from "src/utils/constants";
import { EditorWrapper } from "./EditorWrapper";

/** Abstract base class for note views with an inline editor. */
export abstract class AbstractNoteView extends ItemView {
	private initialState: any = null;
	private saveActionEl!: HTMLElement;
	protected plugin: SandboxNotePlugin;
	public isSourceMode = true;
	public noteGroupId: string | null = null; // ここで初期値としてnullを設定
	public scope: Scope;
	public wrapper: EditorWrapper;

	public navigation = true;

	constructor(leaf: WorkspaceLeaf, plugin: SandboxNotePlugin) {
		super(leaf);
		this.plugin = plugin;
		this.wrapper = new EditorWrapper(this);
		this.scope = new Scope(this.app.scope);
	}

	public get editor() {
		return this.wrapper.virtualEditor?.editor;
	}

	protected abstract get hasUnsavedChanges(): boolean;
	protected abstract getBaseTitle(): string;
	protected abstract handleSaveRequest(): Promise<void>;
	protected abstract loadInitialContent(): Promise<string>;
	public abstract getContent(): string;
	public abstract getIcon(): string;
	public abstract getViewType(): string;
	public abstract save(): Promise<void>;

	public override getDisplayText(): string {
		const baseTitle = this.getBaseTitle();
		const shouldShowUnsaved = this.hasUnsavedChanges;
		return shouldShowUnsaved ? `*${baseTitle}` : baseTitle;
	}

	public override getState(): any {
		const state = super.getState();

		// Add the note group ID to the state
		state.noteGroupId = this.noteGroupId;

		if (this.editor) {
			const editorState = MarkdownView.prototype.getState.call(
				this.wrapper.virtualEditor
			);
			Object.assign(state, editorState);
			state.content = this.editor.getValue();
			state.source = this.isSourceMode;
		} else {
			state.content = this.wrapper.getContent();
			state.source = this.isSourceMode;
		}
		return state;
	}

	public override async onOpen() {
		// super.onOpen() の呼び出しは AbstractNoteView の最後に移動させるか、
		// ここで最初に呼び出すようにする。
		// ここでは setState が確実に実行されるように、このクラスの setState が呼ばれる前に
		// leaf.setViewState が呼ばれることを期待する。
		// しかし、leaf.setViewState は AbstractNoteView の setState の中から呼ばれるので、
		// super.onOpen() を最初に呼ぶのが一番安全です。

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

	public override async onClose() {
		this.wrapper.unload();
		this.contentEl.empty();
	}

	public override async setState(
		state: any,
		result: ViewStateResult
	): Promise<void> {
		// noteGroupIdの初期化をここで行う
		if (state?.noteGroupId) {
			this.noteGroupId = state.noteGroupId;
			log.debug(`Restored note group ID: ${this.noteGroupId}`);
		} else if (!this.noteGroupId) {
			log.error("noteGroupId not found in state");
			this.noteGroupId = `${HOT_SANDBOX_ID_PREFIX}-${nanoid()}`;
		}

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

	public override onPaneMenu(
		menu: Menu,
		source: "more-options" | "tab-header" | string
	) {
		menu.addItem((item) =>
			item
				.setTitle("Convert to file")
				.setIcon("file-pen-line")
				.onClick(async () => {
					await this.convertToFileAndClear();
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
	}

	public setContent(content: string) {
		if (this.editor && this.editor.getValue() !== content) {
			this.editor.setValue(content);
		}
	}

	public async convertToFileAndClear() {
		try {
			const content = this.getContent();
			const baseTitle = this.getBaseTitle();

			// Sanitize title to create a valid filename
			const sanitizedTitle =
				baseTitle.replace(/[\\/:"*?<>|]+/g, "").trim() || "Untitled";

			// Determine the folder for the new file, respecting Obsidian's settings
			const parentFolder = this.app.fileManager.getNewFileParent("");

			let initialPath: string;
			if (parentFolder.isRoot()) {
				initialPath = `${sanitizedTitle}.md`;
			} else {
				initialPath = `${parentFolder.path}/${sanitizedTitle}.md`;
			}

			// Find an available path to avoid overwriting existing files
			const filePath = this.app.vault.getAvailablePath(initialPath, "md");

			// Create the new file in the vault
			const newFile = await this.app.vault.create(filePath, content);

			// Open the new file in the current leaf, replacing this view
			await this.leaf.openFile(newFile);

			// Show a confirmation notice
			new Notice(`${baseTitle} converted to file: ${newFile.path}`);

			this.setContent("");
		} catch (error) {
			log.error("Sandbox Note: Failed to convert to file.", error);
			new Notice(
				"Sandbox Note: Failed to convert to file. See console for details."
			);
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

		this.scope.register(["Mod"], "s", () => {
			this.handleSaveRequest();
		});
	}

	public updateActionButtons() {
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
}
