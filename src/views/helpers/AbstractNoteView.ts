// E:\Desktop\coding\pub\obsidian-sandbox-note\src\views\helpers\AbstractNoteView.ts
import {
	ItemView,
	MarkdownView,
	Notice,
	type ViewStateResult,
	WorkspaceLeaf,
} from "obsidian";

import log from "loglevel";
import { around } from "monkey-around";
import { handleClick, handleContextMenu } from "src/helpers/clickHandler";
import { updateActionButtons } from "src/helpers/viewHelpers";
import { setContent } from "src/helpers/viewSync";
import type SandboxNotePlugin from "src/main";
import { SANDBOX_NOTE_ICON } from "src/utils/constants";
import { EditorWrapper } from "./EditorWrapper";

/** Abstract base class for note views with an inline editor. */
export abstract class AbstractNoteView extends ItemView {
	plugin: SandboxNotePlugin;
	public wrapper: EditorWrapper;
	saveActionEl!: HTMLElement;
	private onloadCallbacks: (() => void)[] = [];
	private initialState: any = null;
	public isSourceMode = true;

	navigation = true;

	constructor(leaf: WorkspaceLeaf, plugin: SandboxNotePlugin) {
		super(leaf);
		this.plugin = plugin;
		this.wrapper = new EditorWrapper(this);
	}

	get editor() {
		return this.wrapper.virtualEditor.editor;
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
		}
		await super.setState(state, result);
	}

	/**
	 * Patches leaf.setViewState to handle calls from internal commands.
	 * Commands like `editor:toggle-source` call setViewState with `type: "markdown"`.
	 * This patch intercepts the call and corrects the type to our view's actual type,
	 * preventing the view from being closed and re-opened unnecessarily.
	 */
	private applyViewStatePatch() {
		const view = this;
		this.register(
			around(this.leaf, {
				setViewState: (originalSetViewState) =>
					async function (this: WorkspaceLeaf, state, result) {
						if (state.type === "markdown") {
							state.type = view.getViewType();
						}
						return originalSetViewState.call(this, state, result);
					},
			})
		);
	}

	async onOpen() {
		this.applyViewStatePatch();
		this.registerActiveLeafEvents();

		try {
			await this.initializeEditor();
			await this.loadContent();
			this.setupEventHandlers();
			this.connectEditorPlugin();
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

	private async initializeEditor() {
		await this.wrapper.onload();
		const editorContainer = this.contentEl.createEl("div", {
			cls: "sandbox-note-container",
		});
		this.wrapper.load(editorContainer);
	}

	private async loadContent() {
		const initialContent =
			this.initialState?.content ?? (await this.loadInitialContent());
		this.wrapper.content = initialContent;
		this.setContent(initialContent);
		if (this.initialState) {
			await this.wrapper.virtualEditor.setState(this.initialState, {
				history: false,
			});
			this.initialState = null;
		}
		// Initial state is considered "saved" by the manager
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

		// Use the capture phase to reliably catch the Ctrl+S hotkey, which is otherwise difficult to intercept in Obsidian.
		this.registerDomEvent(window, "keydown", this.onKeyDown, {
			capture: true,
		});
	}

	private onKeyDown = (e: KeyboardEvent) => {
		const activeView = this.app.workspace.activeLeaf?.view;
		if (activeView !== this) return;

		if (!this.editor?.hasFocus()) return;
		if (this.plugin.settings.enableCtrlS && e.ctrlKey && e.key === "s") {
			e.preventDefault(); // Prevent default browser save action
			log.debug("Saving note via Ctrl+S");
			this.save();
		}
	};

	private connectEditorPlugin() {
		if (!this.editor) return;
		this.onloadCallbacks.push(() => {
			const editorPlugin = this.editor.cm.plugin(
				this.plugin.editorPluginConnector.watchEditorPlugin
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

	async onClose() {
		this.wrapper.unload();
		this.contentEl.empty();
	}
}
