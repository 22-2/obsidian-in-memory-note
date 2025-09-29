import type { Extension } from "@codemirror/state";
import type { ViewPlugin } from "@codemirror/view";
import type { Plugin } from "obsidian";
import type { AppEvents } from "src/events/AppEvents";
import type SandboxNotePlugin from "src/main";
import { VIEW_TYPE_HOT_SANDBOX } from "src/utils/constants";
import type { EventEmitter } from "src/utils/EventEmitter";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";
import { AbstractNoteView } from "src/views/internal/AbstractNoteView";
import {
	syncEditorPlugin,
	SyncEditorPlugin,
} from "src/views/internal/SyncEditorPlugin";
import type { Manager } from "./Manager";
import type { ViewManager } from "./ViewManager";

type Context = {
	emitter: EventEmitter<AppEvents>;
	plugin: Plugin;
	getActiveView: ViewManager["getActiveView"];
};

/** Manages editor extensions and plugin connections */
export class EditorPluginConnector implements Manager {
	constructor(private context: Context) {}

	/** Register editor extension and set up event listeners */
	public load() {
		this.context.plugin.registerEditorExtension(
			syncEditorPlugin as Extension
		);

		this.context.emitter.on(
			"obsidian-layout-changed",
			this.handleLayoutChange
		);
		this.context.emitter.on(
			"obsidian-active-leaf-changed",
			this.handleActiveLeafChange
		);
	}

	/** Unload event listeners. */
	public unload() {
		this.context.emitter.off(
			"obsidian-layout-changed",
			this.handleLayoutChange
		);
		this.context.emitter.off(
			"obsidian-active-leaf-changed",
			this.handleActiveLeafChange
		);
	}

	/** Connect watch editor plugin to view */
	connectEditorPluginToView(view: AbstractNoteView) {
		if (!view?.editor) return;

		// FIXME
		const editorPlugin = view.editor.cm.plugin(
			// @ts-expect-error
			syncEditorPlugin as unknown as ViewPlugin<SyncEditorPlugin, any>
		);
		if (editorPlugin instanceof SyncEditorPlugin) {
			editorPlugin.connectToPlugin(
				this.context.plugin as SandboxNotePlugin,
				view,
				this.context.emitter
			);
		}
	}

	/** Connects the editor plugin to any existing sandbox views on layout change. */
	private handleLayoutChange = () => {
		this.context.plugin.app.workspace
			.getLeavesOfType(VIEW_TYPE_HOT_SANDBOX)
			.forEach((leaf) => {
				const view = leaf.view;
				if (view instanceof HotSandboxNoteView) {
					this.connectEditorPluginToView(view);
				}
			});
		this.syncActiveEditorState();
	};

	/** Connects the editor plugin to the newly active view and syncs editor state. */
	private handleActiveLeafChange = (
		payload: AppEvents["obsidian-active-leaf-changed"]
	) => {
		const { view } = payload;
		if (view) {
			this.connectEditorPluginToView(view);
		}
		this.syncActiveEditorState();
	};

	/**
	 * Syncs Obsidian's internal active editor state with our virtual editor.
	 * This ensures that commands and other editor features work correctly.
	 */
	private syncActiveEditorState(): void {
		const activeView = this.context.getActiveView();
		// @ts-ignore
		const workspace = this.context.plugin.app.workspace;

		if (activeView instanceof AbstractNoteView && activeView.editor) {
			workspace._activeEditor = activeView.wrapper.virtualEditor;
		} else if (
			// @ts-expect-error
			workspace._activeEditor?.leaf?.__FAKE_LEAF__ &&
			!(activeView instanceof AbstractNoteView)
		) {
			workspace._activeEditor = null;
		}
	}
}
