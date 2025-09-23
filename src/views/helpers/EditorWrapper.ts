// E:\Desktop\coding\pub\obsidian-sandbox-note\src\views\helpers\EditorWrapper.ts
import { type Editor, WorkspaceLeaf } from "obsidian";
import { noop } from "../../utils";
import type { AbstractNoteView } from "./AbstractNoteView";
import { UnsafeMarkdownView } from "./UnsafeMarkdownView";

/** Manages inline MarkdownView without physical file. */
export class EditorWrapper {
	public virtualEditor!: UnsafeMarkdownView;
	containerEl!: HTMLDivElement;
	public targetEl: HTMLElement | null = null;
	public content = "";

	constructor(public parentView: AbstractNoteView) {}

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
		this.parentView.plugin.registerDomEvent(
			this.targetEl,
			"focusin",
			this.handleFocusIn
		);
		this.handleFocusIn();
	}

	focus() {
		this.virtualEditor.editor.focus();
	}

	private handleFocusIn = () => {
		// @ts-ignore
		this.parentView.plugin.app.workspace._activeEditor = this.virtualEditor;
	};

	unload() {
		this.content = this.getContent();
		if (this.targetEl) {
			this.targetEl.empty();
			this.targetEl = null;
		}
	}

	async onload() {
		this.containerEl = document.createElement("div");
		this.containerEl.addClasses(["sandbox-inline-editor"]);

		this.virtualEditor = new UnsafeMarkdownView(
			this.unsafeCreateFakeLeaf(),
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

	private unsafeCreateFakeLeaf() {
		// --- The Magic ---
		// We create a "fake" leaf object to trick the MarkdownView constructor.
		// The goal is to make it render inside our `containerEl` instead of the
		// leaf's main container. This avoids modifying the real leaf,
		// preventing crashes and instability.
		const fakeLeaf = {
			...this.parentView.leaf,
			containerEl: this.containerEl,
			// Prevent the virtual view from causing side effects
			getHistoryState: () => ({}),
			open: noop,
			getRoot: noop,
			updateHeader: noop,
		} as unknown as WorkspaceLeaf;
		return fakeLeaf;
	}
}
