import { ViewUpdate, type PluginValue, ViewPlugin } from "@codemirror/view";
import type SandboxNotePlugin from "../../main";
import { type Debouncer, debounce } from "obsidian";
import { AbstractNoteView } from "./AbstractNoteView";

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

			// Update the unsaved state for the current view
			this.connectedView.updateUnsavedState(updatedContent);

			// Let the view handle the content change
			this.connectedView.onContentChanged(updatedContent);

			// Trigger debounced save if enabled
			this.debouncer?.();
		}
	}

	/** Connect to main plugin and view. */
	connectToPlugin(plugin: SandboxNotePlugin, view: AbstractNoteView): void {
		this.connectedPlugin = plugin;
		this.connectedView = view;

		if (this.connectedPlugin.settings.enableAutoSave) {
			this.debouncer = debounce(
				() => {
					if (this.connectedView) {
						this.connectedView.save();
					}
				},
				this.connectedPlugin.settings.autoSaveDebounceMs,
				true // Save on leading edge is false by default
			);
		}
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
