import {
	ViewUpdate,
	type PluginValue,
	ViewPlugin,
} from "@codemirror/view";
import type InMemoryNotePlugin from "./main";
import type { InMemoryNoteView } from "./view";

/** CodeMirror plugin for syncing content across views. */
export class EditorWatchPlugin implements PluginValue {
	private connectedPlugin: InMemoryNotePlugin | null = null;
	private connectedView: InMemoryNoteView | null = null;

	/** Update shared content through main plugin. */
	private propagateContentChange(content: string) {
		if (this.connectedPlugin && this.connectedView) {
			this.connectedPlugin.updateNoteContent(content, this.connectedView);
		}
	}

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
			
			// Propagate content changes to other views
			this.propagateContentChange(updatedContent);
		}
	}

	/** Connect to main plugin and view. */
	connectToPlugin(plugin: InMemoryNotePlugin, view: InMemoryNoteView): void {
		this.connectedPlugin = plugin;
		this.connectedView = view;
	}

	/** Cleanup on destroy. */
	destroy(): void {
		this.connectedPlugin = null;
		this.connectedView = null;
	}
}

/** CodeMirror ViewPlugin for watching changes. */
export const watchEditorPlugin = ViewPlugin.fromClass(EditorWatchPlugin);
