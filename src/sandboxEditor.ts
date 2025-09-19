import { type Editor, MarkdownView } from "obsidian";
import { SandboxNoteView } from "./view";
import { noop } from "./utils";

export interface InlineMarkdownView extends MarkdownView {
	__setViewData__: MarkdownView["setViewData"];
}

/** Manages inline MarkdownView without physical file. */
export class SandboxEditor {
	public inlineView!: InlineMarkdownView;
	private containerElement!: HTMLElement;
	public targetElement: HTMLElement | null = null;

	/** Content storage when editor not loaded. */
	public content = "";

	constructor(private parentView: SandboxNoteView) {}

	/** Get current editor content. */
	getContent() {
		return this.inlineView.editor.getValue();
	}

	/** Get editor instance. */
	getEditor(): Editor {
		return this.inlineView.editor;
	}

	/** Set editor content. */
	setContent(content: string) {
		this.inlineView.__setViewData__(content, true);
	}

	/** Attach editor to target element. */
	load(target: HTMLElement) {
		// Restore content from temporary storage
		this.setContent(this.content);
		target.append(this.containerElement);

		// Focus the editor after DOM is ready
		setTimeout(() => this.focus());

		this.targetElement = target;
		this.parentView.plugin.registerDomEvent(
			this.targetElement,
			"focusin",
			this.handleFocusIn
		);
		this.handleFocusIn();
	}

	/** Focus the editor. */
	focus() {
		this.inlineView.editor.focus();
	}

	/** Set as active editor for workspace integration. */
	private handleFocusIn = () => {
		// @ts-ignore - Accessing private property to integrate with Obsidian's editor system
		this.parentView.plugin.app.workspace._activeEditor = this.inlineView;
	};

	/** Detach editor and preserve content. */
	unload() {
		// Preserve current content before unloading
		this.content = this.getContent();
		if (this.targetElement) {
			this.targetElement.empty();
			this.targetElement = null;
		}
	}

	/** Initialize inline MarkdownView. */
	async onload() {
		this.containerElement = document.createElement("div");
		this.containerElement.addClasses(["sandbox-inline-editor"]);

		// Create the inline MarkdownView with necessary configuration
		this.inlineView = new MarkdownView({
			containerEl: this.containerElement,
			app: this.parentView.plugin.app,
			workspace: this.parentView.plugin.app.workspace,
			history: {
				backHistory: [],
				forwardHistory: [],
			},
		} as never) as InlineMarkdownView;

		// Disable save operations to prevent file system interactions
		this.disableSaveOperations();

		// Ensure the editor starts in source mode
		await this.ensureSourceMode();
	}

	/** Disable save operations to prevent file system writes. */
	private disableSaveOperations() {
		this.inlineView.save = noop;
		this.inlineView.saveTitle = noop;
		this.inlineView.requestSave = () => {};
		this.inlineView.__setViewData__ = this.inlineView.setViewData;
		this.inlineView.setViewData = noop;
	}

	/** Ensure editor is in source mode. */
	private async ensureSourceMode() {
		if (this.inlineView.getMode() === "preview") {
			await this.inlineView.setState(
				{ mode: "source" },
				{ history: false }
			);
		}
	}
}
