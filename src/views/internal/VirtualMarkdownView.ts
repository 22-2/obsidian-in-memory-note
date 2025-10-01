// E:\Desktop\coding\pub\obsidian-sandbox-note\src\views\helpers\UnsafeMarkdownView.ts
import { MarkdownView, WorkspaceLeaf } from "obsidian";
import type { EditorWrapper } from "./EditorWrapper";

export class VirtualMarkdownView extends MarkdownView {
	constructor(leaf: WorkspaceLeaf, public wrapper: EditorWrapper) {
		super(leaf);
	}

	// This is overridden to prevent file system interactions.
	// The parent view handles content changes.
	__setViewData__(data: string, clear: boolean) {}

	getState(): any {
		const editorState = super.getState();
		const content = this.wrapper.getContent();
		return { ...editorState, content: content };
	}
}
