import type InMemoryNotePlugin from "../main";
import type { InMemoryNoteView } from "../view";
import { watchEditorPlugin } from "../watchEditorPlugin";

/** Manages editor extensions and plugin connections */
export class EditorManager {
	private plugin: InMemoryNotePlugin;

	/** CodeMirror plugin for watching changes */
	watchEditorPlugin = watchEditorPlugin;

	constructor(plugin: InMemoryNotePlugin) {
		this.plugin = plugin;
	}

	/** Register editor extension for watching changes */
	setupEditorExtension() {
		this.plugin.registerEditorExtension(watchEditorPlugin);
	}

	/** Connect watch editor plugin to view */
	connectEditorPluginToView(view: InMemoryNoteView) {
		const editorPlugin = view.inlineEditor.inlineView.editor.cm.plugin(watchEditorPlugin);
		if (editorPlugin) {
			editorPlugin.connectToPlugin(this.plugin, view);
		}
	}
}