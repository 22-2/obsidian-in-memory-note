import { type Editor, MarkdownView } from "obsidian";
import { InMemoryNoteView } from "./view";
import { noop } from "./utils";

export interface InlineMarkdownView extends MarkdownView {
	__setViewData__: MarkdownView["setViewData"];
}

/**
 * Manages an inline MarkdownView instance within a custom view.
 * This class provides an editor interface that is not tied to a physical file.
 */
export class InlineEditor {
	public inlineView!: InlineMarkdownView;
	private containerElement!: HTMLElement;
	public targetElement: HTMLElement | null = null;

	/**
	 * Stores the editor content when the editor is not loaded.
	 */
	public content = "";

	constructor(private parentView: InMemoryNoteView) {}

	/**
	 * Gets the current content from the editor.
	 * @returns The editor's content as a string.
	 */
	getContent() {
		return this.inlineView.editor.getValue();
	}

	/**
	 * Gets the underlying editor instance.
	 * @returns The Editor object.
	 */
	getEditor(): Editor {
		return this.inlineView.editor;
	}

	/**
	 * Sets the content of the editor.
	 * @param content The new content to set.
	 */
	setContent(content: string) {
		this.inlineView.__setViewData__(content, true);
	}

	/**
	 * Attaches the editor to a target HTML element.
	 * @param target The element to append the editor to.
	 */
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

	/**
	 * Focuses the editor.
	 */
	focus() {
		this.inlineView.editor.focus();
	}

	/**
	 * Sets this editor as the active editor in the workspace.
	 * This enables standard markdown view operations to work properly.
	 */
	private handleFocusIn = () => {
		// @ts-ignore - Accessing private property to integrate with Obsidian's editor system
		this.parentView.plugin.app.workspace._activeEditor = this.inlineView;
	};

	/**
	 * Detaches the editor from the DOM and preserves its content.
	 */
	unload() {
		// Preserve current content before unloading
		this.content = this.getContent();
		if (this.targetElement) {
			this.targetElement.empty();
			this.targetElement = null;
		}
	}

	/**
	 * Initializes the inline MarkdownView instance.
	 * Must be called before loading the editor into the DOM.
	 */
	async onload() {
		this.containerElement = document.createElement("div");
		this.containerElement.addClasses(["in-memory-inline-editor"]);

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

	/**
	 * Disables all save-related operations for the inline view.
	 * This prevents the editor from attempting to save to the file system.
	 */
	private disableSaveOperations() {
		this.inlineView.save = noop;
		this.inlineView.saveTitle = noop;
		this.inlineView.requestSave = () => {};
		this.inlineView.__setViewData__ = this.inlineView.setViewData;
		this.inlineView.setViewData = noop;
	}

	/**
	 * Ensures the editor is in source mode rather than preview mode.
	 */
	private async ensureSourceMode() {
		if (this.inlineView.getMode() === "preview") {
			await this.inlineView.setState(
				{ mode: "source" },
				{ history: false }
			);
		}
	}
}
