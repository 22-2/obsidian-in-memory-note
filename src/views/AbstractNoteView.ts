// E:\Desktop\coding\pub\obsidian-sandbox-note\src\views\AbstractNoteView.ts
import {
	ItemView,
	MarkdownView,
	Notice,
	type ViewStateResult,
	WorkspaceLeaf,
} from "obsidian";
import { EditorWrapper } from "src/views/EditorWrapper";
import type SandboxNotePlugin from "../main";
import { updateActionButtons } from "../helpers/viewHelpers";
import { setContent } from "../helpers/viewSync";
import { SANDBOX_NOTE_ICON } from "../utils/constants";
import { handleClick, handleContextMenu } from "src/helpers/clickHandler";
import log from "loglevel";
import { around } from "monkey-around";

/** Abstract base class for note views with an inline editor. */
export abstract class AbstractNoteView extends ItemView {
	plugin: SandboxNotePlugin;
	public wrapper: EditorWrapper;
	hasUnsavedChanges = false;
	initialContent = "";
	saveActionEl!: HTMLElement;
	private onloadCallbacks: (() => void)[] = [];
	private initialState: any = null;
	public isSourceMode = true;

	navigation = true; // Prevent renaming prompts

	constructor(leaf: WorkspaceLeaf, plugin: SandboxNotePlugin) {
		super(leaf);
		this.plugin = plugin;
		this.wrapper = new EditorWrapper(this);
	}

	get editor() {
		return this.wrapper.getEditor();
	}

	abstract getViewType(): string;
	abstract loadInitialContent(): Promise<string>;
	abstract save(): Promise<void>;
	onContentChanged(content: string): void {}
	abstract getBaseTitle(): string;
	getDisplayText(): string {
		const baseTitle = this.getBaseTitle();
		const shouldShowUnsaved =
			this.plugin.settings.enableSaveNoteContent &&
			this.hasUnsavedChanges;
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
			state.content = this.initialContent;
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
			this.markAsSaved();
			await this.wrapper.virtualEditor.setState(state, result);
		}
		await super.setState(state, result);
	}

	// --- ✨ ここからが修正点 ✨ ---
	/**
	 * `editor:toggle-source`のような内部コマンドが`type:"markdown"`で
	 * `setViewState`を呼び出す問題を解決するためのパッチ。
	 *
	 * 呼び出しをインターセプトし、`type`が`"markdown"`であれば、
	 * このビューの正しいタイプに書き換える。これにより、`setViewState`が
	 * ビューの再生成（`close`->`open`）を行わず、`setState`のみを
	 * 呼び出すようにする。
	 */
	private applyViewStatePatch() {
		const view = this;
		this.register(
			around(this.leaf, {
				setViewState: (originalSetViewState) =>
					async function (this: WorkspaceLeaf, state, result) {
						// 内部コマンドによる`type:"markdown"`を検知したら...
						if (state.type === "markdown") {
							// ...私たちの正しいビュータイプに書き換える
							state.type = view.getViewType();
						}
						// 修正したstateで元の処理を呼び出す
						return originalSetViewState.call(this, state, result);
					},
			})
		);
	}
	// --- ✨ ここまで ✨ ---

	async onOpen() {
		// --- ✨ 修正点: パッチの呼び出しを復活させる ✨ ---
		this.applyViewStatePatch();

		this.plugin.registerEvent(
			this.plugin.app.workspace.on("active-leaf-change", (leaf) => {
				if (leaf?.id === this.leaf.id) {
					this.editor?.focus();
				}
			})
		);
		try {
			await this.wrapper.onload();
			const editorContainer = this.contentEl.createEl("div", {
				cls: "sandbox-note-container",
			});
			this.wrapper.load(editorContainer);
			const initialContent =
				this.initialState?.content ?? (await this.loadInitialContent());
			this.initialContent = initialContent;
			this.wrapper.content = initialContent;
			this.setContent(initialContent);
			if (this.initialState) {
				await this.wrapper.virtualEditor.setState(this.initialState, {
					history: false,
				});
				this.initialState = null;
			}
			this.setupEventHandlers();
			this.connectEditorPlugin();
		} catch (error) {
			log.error(
				"Sandbox Note: Failed to initialize inline editor.",
				error
			);
			new Notice("Sandbox Note: Failed to initialize inline editor.");
			this.contentEl.empty();
			this.contentEl.createEl("div", {
				text: "Error: Could not initialize editor. This might be due to an Obsidian update.",
				cls: "sandbox-error-message",
			});
		}
	}

	private setupEventHandlers() {
		if (!this.editor) return;
		this.registerDomEvent(
			this.contentEl,
			"mousedown",
			handleClick.bind(null, this.editor)
		);
		this.registerDomEvent(
			this.contentEl,
			"contextmenu",
			handleContextMenu.bind(
				null,
				this.app.commands,
				this.wrapper.virtualEditor.editMode
			)
		);
	}

	private connectEditorPlugin() {
		if (!this.editor) return;
		this.onloadCallbacks.push(() => {
			const editorPlugin = this.editor.cm.plugin(
				this.plugin.editorManager.watchEditorPlugin
			);
			if (editorPlugin) {
				editorPlugin.connectToPlugin(this.plugin, this as any);
			}
		});
	}

	onload(): void {
		this.onloadCallbacks.forEach((callback) => callback());
		this.onloadCallbacks = [];
	}

	updateActionButtons() {
		updateActionButtons(this);
	}

	updateUnsavedState(currentContent: string) {
		if (!this.plugin.settings.enableSaveNoteContent) {
			this.hasUnsavedChanges = false;
			this.updateActionButtons();
			return;
		}
		const wasUnsaved = this.hasUnsavedChanges;
		this.hasUnsavedChanges = currentContent !== this.initialContent;
		this.updateActionButtons();
		if (wasUnsaved !== this.hasUnsavedChanges) {
			this.leaf.updateHeader();
		}
	}

	markAsSaved() {
		if (this.editor) {
			this.initialContent = this.editor.getValue();
			this.updateUnsavedState(this.initialContent);
		}
	}

	async onClose() {
		this.wrapper.unload();
		this.contentEl.empty();
	}
}
