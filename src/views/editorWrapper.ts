import { type Editor, MarkdownView } from "obsidian";
import { noop } from "../utils";
import type { AbstractNoteView } from "./AbstractNoteView";

export interface UnsafeVirtualMarkdownView extends MarkdownView {
	__setViewData__: MarkdownView["setViewData"];
}

/** Manages inline MarkdownView without physical file. */
export class EditorWrapper {
	public virtualEditor!: UnsafeVirtualMarkdownView;
	private containerEl!: HTMLElement;
	public targetEl: HTMLElement | null = null;

	/** Content storage when editor not loaded. */
	public content = "";

	constructor(private parentView: AbstractNoteView) {}

	/** Get current editor content. */
	getContent() {
		return this.virtualEditor.editor.getValue();
	}

	/** Get editor instance. */
	getEditor(): Editor {
		return this.virtualEditor.editor;
	}

	/** Set editor content. */
	setContent(content: string) {
		this.virtualEditor.__setViewData__(content, true);
	}

	/** Attach editor to target element. */
	load(target: HTMLElement) {
		// Restore content from temporary storage
		this.setContent(this.content);
		target.append(this.containerEl);

		// Focus the editor after DOM is ready
		setTimeout(() => this.focus());

		this.targetEl = target;
		this.parentView.plugin.registerDomEvent(
			this.targetEl,
			"focusin",
			this.handleFocusIn
		);
		this.handleFocusIn();
	}

	/** Focus the editor. */
	focus() {
		this.virtualEditor.editor.focus();
	}

	/** Set as active editor for workspace integration. */
	private handleFocusIn = () => {
		// @ts-ignore - Accessing private property to integrate with Obsidian's editor system
		this.parentView.plugin.app.workspace._activeEditor = this.virtualEditor;
	};

	/** Detach editor and preserve content. */
	unload() {
		// Preserve current content before unloading
		this.content = this.getContent();
		if (this.targetEl) {
			this.targetEl.empty();
			this.targetEl = null;
		}
	}

	/** Initialize inline MarkdownView. */
	async onload() {
		this.containerEl = document.createElement("div");
		this.containerEl.addClasses(["sandbox-inline-editor"]);

		// Create the inline MarkdownView with necessary configuration
		this.virtualEditor = new MarkdownView({
			containerEl: this.containerEl,
			app: this.parentView.plugin.app,
			workspace: this.parentView.plugin.app.workspace,
			history: {
				backHistory: [],
				forwardHistory: [],
			},
		} as never) as UnsafeVirtualMarkdownView;

		// Disable save operations to prevent file system interactions
		this.disableSaveOperations();

		// Ensure the editor starts in source mode
		await this.ensureSourceMode();
	}

	/** Disable save operations to prevent file system writes. */
	private disableSaveOperations() {
		this.virtualEditor.save = noop;
		this.virtualEditor.saveTitle = noop;
		this.virtualEditor.requestSave = noop;
		this.virtualEditor.__setViewData__ = this.virtualEditor.setViewData;
		this.virtualEditor.setViewData = noop;
	}

	/** Ensure editor is in source mode. */
	private async ensureSourceMode() {
		if (this.virtualEditor.getMode() === "preview") {
			await this.virtualEditor.setState(
				{ mode: "source" },
				{ history: false }
			);
		}
	}
}
