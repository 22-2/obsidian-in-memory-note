import {
	type Editor,
	type EditorPosition,
	MarkdownView,
	TFile,
} from "obsidian";
import { createVirtualFile } from "./utils/obsidian";
import { InMemoryNoteView } from "./view";

const noop = async () => {};

export type InlineMarkdownView = MarkdownView & {
	__setViewData__: MarkdownView["setViewData"];
};

/**
 * Manages an inline MarkdownView instance within a custom view.
 * This class provides an editor interface that is not tied to a physical file.
 */
export class InlineEditor {
	private inlineView!: InlineMarkdownView;
	private containerEl!: HTMLElement;
	target: HTMLElement | null = null;
	/**
	 * Holds the editor content, especially when the editor is not loaded.
	 */
	public content = "";

	constructor(private view: InMemoryNoteView) {}

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
		// Set content from the temporary store
		this.setContent(this.content);
		target.append(this.containerEl);
		this.focus();
		this.target = target;
	}

	/**
	 * Focuses the editor.
	 */
	focus() {
		this.inlineView.editor.focus();
	}

	/**
	 * Detaches the editor from the DOM and stores its content.
	 */
	unload() {
		// Store current content before unloading
		this.content = this.getContent();
		if (this.target) {
			this.target.empty();
			this.target = null;
		}
	}

	/**
	 * Initializes the inline MarkdownView instance.
	 * This should be called before the editor is loaded.
	 */
	async onload() {
		this.containerEl = document.createElement("div");
		this.containerEl.addClasses(["in-memory-inline-editor"]);

		this.inlineView = new MarkdownView({
			containerEl: this.containerEl,
			app: this.view.plugin.app,
			workspace: this.view.plugin.app.workspace,
			history: {
				backHistory: [],
				forwardHistory: [],
			},
		} as any) as InlineMarkdownView;

		// Workaround for Templater plugin and to prevent saving operations
		// const virtualFile = createVirtualFile(this.view.app);
		// this.inlineView.file = virtualFile as TFile;
		this.inlineView.save = noop;
		this.inlineView.requestSave = () => {};
		this.inlineView.__setViewData__ = this.inlineView.setViewData;
		this.inlineView.setViewData = noop;

		if (this.inlineView.getMode() === "preview") {
			await this.inlineView.setState(
				{ mode: "source" },
				{ history: false }
			);
		}
	}
}
