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
import type { Extension } from "@codemirror/state";
import type { PluginValue, ViewPlugin } from "@codemirror/view";

/** Manages editor extensions and plugin connections */
export class EditorPluginConnector implements Manager {
	private plugin: SandboxNotePlugin;
	private emitter: EventEmitter<AppEvents>;

	constructor(plugin: SandboxNotePlugin, emitter: EventEmitter<AppEvents>) {
		this.plugin = plugin;
		this.emitter = emitter;
	}

	/** Register editor extension and set up event listeners */
	public load() {
		this.plugin.registerEditorExtension(syncEditorPlugin as Extension);

		this.emitter.on("obsidian-layout-changed", this.handleLayoutChange);
		this.emitter.on(
			"obsidian-active-leaf-changed",
			this.handleActiveLeafChange
		);
	}

	/** Unload event listeners. */
	public unload() {
		this.emitter.off("obsidian-layout-changed", this.handleLayoutChange);
		this.emitter.off(
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
			editorPlugin.connectToPlugin(this.plugin, view, this.emitter);
		}
	}

	/** Connects the editor plugin to any existing sandbox views on layout change. */
	private handleLayoutChange = () => {
		this.plugin.app.workspace
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
		const activeView = this.plugin.getActiveView();
		// @ts-ignore
		const workspace = this.plugin.app.workspace;

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
