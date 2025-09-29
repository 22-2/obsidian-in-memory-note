// E:\Desktop\coding\pub\obsidian-sandbox-note\src\views\helpers\EditorWrapper.ts
import log from "loglevel";
import { type ViewStateResult, WorkspaceLeaf } from "obsidian";
import { noop } from "src/utils";
import type { AbstractNoteView } from "./AbstractNoteView";
import { VirtualMarkdownView } from "./VirtualMarkdownView";
import type { AbstractNoteViewState } from "./types";

/** Manages inline MarkdownView without physical file. */
export class EditorWrapper {
	public virtualEditor!: VirtualMarkdownView;
	containerEl!: HTMLDivElement;
	public targetEl: HTMLElement | null = null;
	private content = "";

	constructor(public parentView: AbstractNoteView) {}

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
			initialState?.content ?? (await this.parentView.getContent());
		this.content = initialContent;
		this.parentView.setContent(initialContent);

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
		// this.parentView.plugin.registerDomEvent(
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
	// 	this.parentView.plugin.app.workspace._activeEditor = this.virtualEditor;
	// 	log.debug("this.virtualEditor", this.virtualEditor);
	// 	log.debug(
	// 		"this.parentView.plugin.app.workspace._activeEditor",
	// 		// @ts-expect-error
	// 		this.parentView.plugin.app.workspace._activeEditor
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
			...this.parentView.leaf,
			containerEl: this.containerEl,
			getState: () => {
				const state = this.parentView.getState();
				log.debug("getState", state);
				return state;
			},
			setViewState: async (state: any, result: ViewStateResult) => {
				if (state.type === "markdown") {
					state.type = this.parentView.getViewType();
				}
				log.debug("setViewState", state);
				this.parentView.leaf.setViewState(
					state,
					result || { history: false }
				);
			},
			__FAKE_LEAF__: true,
		} as unknown as WorkspaceLeaf;
		return fakeLeaf;
	}
}
