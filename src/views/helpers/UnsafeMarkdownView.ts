import { MarkdownView, WorkspaceLeaf } from "obsidian";
import type { EditorWrapper } from "./EditorWrapper";

export class UnsafeMarkdownView extends MarkdownView {
	// --- ✨ 修正点 ✨ ---
	// コンストラクタから危険なハックを削除。
	// 呼び出し元が、細工したleafを渡してくれるので、ここでは何もしなくてよい。
	constructor(leaf: WorkspaceLeaf, public wrapper: EditorWrapper) {
		super(leaf);
	}

	// --- ✨ ここまで ✨ ---
	__setViewData__(data: string, clear: boolean) {}

	getState(): any {
		const editorState = super.getState();
		const content = this.wrapper.parentView.editor?.getValue();
		return { ...editorState, content: content };
	}
}
