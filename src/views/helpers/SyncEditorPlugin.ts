import { ViewUpdate, type PluginValue, ViewPlugin } from "@codemirror/view";
import type SandboxNotePlugin from "../../main";
import { type Debouncer, debounce } from "obsidian";
import { AbstractNoteView } from "./AbstractNoteView";
import { SandboxNoteView } from "src/views/SandboxNoteView";

/** CodeMirror plugin for syncing content across views. */
export class SyncEditorPlugin implements PluginValue {
	private connectedPlugin: SandboxNotePlugin | null = null;
	private connectedView: AbstractNoteView | null = null;
	private debouncer: Debouncer<[], void> | null = null;

	/** Handle editor updates and propagate changes. */
	update(update: ViewUpdate): void {
		// Only proceed if plugin and view are connected
		if (!this.connectedPlugin || !this.connectedView) {
			return;
		}

		// Only process actual document changes
		if (update.docChanged) {
			const updatedContent = update.state.doc.toString();

			this.connectedPlugin.editorSyncManager.syncAll(
				updatedContent,
				this.connectedView as SandboxNoteView
			);

			// Trigger debounced save if enabled
			this.debouncer?.();
		}
	}

	/** Connect to main plugin and view. */
	connectToPlugin(plugin: SandboxNotePlugin, view: AbstractNoteView): void {
		this.connectedPlugin = plugin;
		this.connectedView = view;

		// SandboxNoteViewの場合だけオートセーブを有効にする
		if (
			this.connectedPlugin.settings.enableAutoSave &&
			view instanceof SandboxNoteView
		) {
			this.debouncer = debounce(
				() => {
					// ここでview.save()を呼ぶことで、オートセーブが機能する
					if (this.connectedView) {
						this.connectedView.save();
					}
				},
				this.connectedPlugin.settings.autoSaveDebounceMs,
				true // Save on leading edge is false by default
			);
		}
		// ▲▲▲▲▲ 変更点 ▲▲▲▲▲
	}

	/** Cleanup on destroy. */
	destroy(): void {
		this.debouncer = null;
		this.connectedPlugin = null;
		this.connectedView = null;
	}
}

/** CodeMirror ViewPlugin for watching changes. */
export const syncEditorPlugin = ViewPlugin.fromClass(SyncEditorPlugin);
