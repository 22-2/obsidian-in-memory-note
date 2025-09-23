import type SandboxNotePlugin from "src/main";
import { syncEditorPlugin } from "src/views/helpers/SyncEditorPlugin";
import type { SandboxNoteView } from "src/views/SandboxNoteView";

/** Manages editor extensions and plugin connections */
export class EditorSyncManager {
	private plugin: SandboxNotePlugin;

	/** CodeMirror plugin for watching changes */
	watchEditorPlugin = syncEditorPlugin;

	constructor(plugin: SandboxNotePlugin) {
		this.plugin = plugin;
	}

	/** Register editor extension for watching changes */
	setupEditorExtension() {
		this.plugin.registerEditorExtension(syncEditorPlugin);
	}

	/** Connect watch editor plugin to view */
	connectEditorPluginToView(view: SandboxNoteView) {
		const editorPlugin =
			view.wrapper.virtualEditor.editor.cm.plugin(syncEditorPlugin);
		if (editorPlugin) {
			editorPlugin.connectToPlugin(this.plugin, view);
		}
	}
}
