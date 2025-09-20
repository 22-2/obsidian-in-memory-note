import type { AbstractNoteView } from "src/views/AbstractNoteView";
import type SandboxNotePlugin from "../main";
import type { SandboxNoteView } from "../views/SandboxNoteView";
import { syncEditorPlugin } from "../views/syncEditorPlugin";

/** Manages editor extensions and plugin connections */
export class EditorManager {
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
