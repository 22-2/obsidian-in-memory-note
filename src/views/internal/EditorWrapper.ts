// E:\Desktop\coding\pub\obsidian-sandbox-note\src\views\helpers\EditorWrapper.ts
import log from "loglevel";
import { type ViewStateResult, WorkspaceLeaf } from "obsidian";
import type { AppEvents } from "src/events/AppEvents";
import { noop } from "src/utils";
import type { EventEmitter } from "src/utils/EventEmitter";
import type { AbstractNoteView } from "./AbstractNoteView";
import { VirtualMarkdownView } from "./VirtualMarkdownView";
import type { AbstractNoteViewState } from "./types";

const logger = log.getLogger("EditorWrapper");

type Context = {
	getActiveView: () => AbstractNoteView | null;
	workspace: {
		_activeEditor: never;
	};
	parentView: AbstractNoteView;
	emitter: EventEmitter<AppEvents>;
};

/** Manages inline MarkdownView without physical file. */
export class EditorWrapper {
	public virtualEditor!: VirtualMarkdownView;
	containerEl!: HTMLDivElement;
	public targetEl: HTMLElement | null = null;
	private content = "";

	constructor(private context: Context) {
		this.context.emitter.on(
			"obsidian-active-leaf-changed",
			this.syncActiveEditorState.bind(this)
		);
	}

	/** Initialize the editor and load content. */
	async initialize(
		target: HTMLElement,
		initialState: AbstractNoteViewState | null
	) {
		await this.onload(); // Create virtual editor
		const editorContainer = target.createEl("div", {
			cls: "sandbox-note-container",
		});
		this.load(editorContainer); // Attach to DOM and focus

		const initialContent =
			initialState?.content ??
			(await this.context.parentView.getContent());
		this.content = initialContent;
		this.context.parentView.setContent(initialContent);

		if (initialState) {
			await this.virtualEditor.setState(initialState, {
				history: false,
			});
		}
	}

	getContent() {
		return this.virtualEditor.editor.getValue();
	}

	setContent(content: string) {
		this.virtualEditor.__setViewData__(content, true);
	}

	load(target: HTMLElement) {
		this.setContent(this.content);
		target.append(this.containerEl);
		setTimeout(() => this.focus());
		this.targetEl = target;
		// this.context.parentView.plugin.registerDomEvent(
		// 	this.targetEl,
		// 	"focusin",
		// 	this.handleFocusIn
		// );
		// this.targetEl.addEventListener("focusin", this.setActiveEditor);
		// this.setActiveEditor();
	}

	focus() {
		this.virtualEditor.editor.focus();
	}

	// private setActiveEditor = () => {
	// 	// @ts-ignore
	// 	this.context.parentView.plugin.app.workspace._activeEditor = this.virtualEditor;
	// 	log.debug("this.virtualEditor", this.virtualEditor);
	// 	log.debug(
	// 		"this.context.parentView.plugin.app.workspace._activeEditor",
	// 		// @ts-expect-error
	// 		this.context.parentView.plugin.app.workspace._activeEditor
	// 	);
	// };

	unload() {
		this.content = this.getContent();
		if (this.targetEl) {
			this.targetEl.empty();
			// this.targetEl.removeEventListener("focusin", this.setActiveEditor);
			this.targetEl = null;
		}
	}

	async onload() {
		this.containerEl = document.createElement("div");
		this.containerEl.addClasses(["sandbox-inline-editor"]);

		this.virtualEditor = new VirtualMarkdownView(
			this.createFakeLeaf(),
			this
		);
		// this.virtualEditor.file = createVirtualFile(this.context.parentView.app);
		this.virtualEditor.leaf.working = false;
		this.disableSaveOperations();
		// await this.ensureSourceMode();
	}

	private disableSaveOperations() {
		this.virtualEditor.save = noop;
		this.virtualEditor.saveTitle = noop;
		this.virtualEditor.requestSave = noop;
		this.virtualEditor.__setViewData__ = this.virtualEditor.setViewData;
		this.virtualEditor.setViewData = noop;
	}

	// private async ensureSourceMode() {
	// 	if (this.virtualEditor.getMode() === "preview") {
	// 		await this.virtualEditor.setState(
	// 			{ mode: "source" },
	// 			{ history: false }
	// 		);
	// 	}
	// }

	private createFakeLeaf() {
		// --- The Magic ---
		// We create a "fake" leaf object to trick the MarkdownView constructor.
		// The goal is to make it render inside our `containerEl` instead of the
		// leaf's main container. This avoids modifying the real leaf,
		// preventing crashes and instability.
		const fakeLeaf = {
			...this.context.parentView.leaf,
			containerEl: this.containerEl,
			getState: () => {
				const state = this.context.parentView.getState();
				logger.debug("getState", state);
				return state;
			},
			setViewState: async (state: any, result: ViewStateResult) => {
				if (state.type === "markdown") {
					state.type = this.context.parentView.getViewType();
				}
				logger.debug(
					"setViewState",
					state,
					"state.state.source",
					state?.state?.source
				);
				this.context.parentView.leaf.setViewState(
					state,
					result || { history: false }
				);
			},
			__FAKE_LEAF__: true,
		} as unknown as WorkspaceLeaf;
		return fakeLeaf;
	}

	/**
	 * Syncs Obsidian's internal active editor state with our virtual editor.
	 * This ensures that commands and other editor features work correctly.
	 */
	private syncActiveEditorState = (): void => {
		const activeView = this.context.getActiveView();
		const workspace = this.context.workspace;

		if (activeView?.editor) {
			// @ts-expect-error
			workspace._activeEditor = activeView.wrapper.virtualEditor;
		} else if (
			// @ts-expect-error
			workspace._activeEditor?.leaf?.__FAKE_LEAF__
		) {
			// @ts-expect-error
			workspace._activeEditor = null;
		}
	};
}
