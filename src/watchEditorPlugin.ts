import {
	ViewUpdate,
	type PluginValue,
	ViewPlugin,
} from "@codemirror/view";
import type InMemoryNotePlugin from "./main";
import type { InMemoryNoteView } from "./view";

/**
 * CodeMirror plugin that watches for editor changes and synchronizes content
 * across multiple in-memory note views.
 */
export class EditorWatchPlugin implements PluginValue {
	private connectedPlugin: InMemoryNotePlugin | null = null;
	private connectedView: InMemoryNoteView | null = null;

	/**
	 * Updates the shared note content through the main plugin.
	 * @param content The new content to propagate.
	 */
	private propagateContentChange(content: string) {
		if (this.connectedPlugin && this.connectedView) {
			this.connectedPlugin.updateNoteContent(content, this.connectedView);
		}
	}

	/**
	 * Handles editor updates and propagates content changes.
	 * @param update The CodeMirror view update.
	 */
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

	/**
	 * Connects this editor plugin to the main plugin and view.
	 * @param plugin The main in-memory note plugin instance.
	 * @param view The view that owns this editor.
	 */
	connectToPlugin(plugin: InMemoryNotePlugin, view: InMemoryNoteView): void {
		this.connectedPlugin = plugin;
		this.connectedView = view;
	}

	/**
	 * Cleanup when the plugin is destroyed.
	 */
	destroy(): void {
		this.connectedPlugin = null;
		this.connectedView = null;
	}
}

/**
 * CodeMirror ViewPlugin instance for watching editor changes.
 */
export const watchEditorPlugin = ViewPlugin.fromClass(EditorWatchPlugin);
