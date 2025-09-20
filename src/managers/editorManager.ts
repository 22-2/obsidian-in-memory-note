import type SandboxNotePlugin from "../main";
import type { SandboxNoteView } from "../SandboxNoteView";
import { watchEditorPlugin } from "../syncEditorPlugin";

/** Manages editor extensions and plugin connections */
export class EditorManager {
	private plugin: SandboxNotePlugin;

	/** CodeMirror plugin for watching changes */
	watchEditorPlugin = watchEditorPlugin;

	constructor(plugin: SandboxNotePlugin) {
		this.plugin = plugin;
	}

	/** Register editor extension for watching changes */
	setupEditorExtension() {
		this.plugin.registerEditorExtension(watchEditorPlugin);
	}

	/** Connect watch editor plugin to view */
	connectEditorPluginToView(view: SandboxNoteView) {
		const editorPlugin =
			view.wrapper.virtualEditor.editor.cm.plugin(watchEditorPlugin);
		if (editorPlugin) {
			editorPlugin.connectToPlugin(this.plugin, view);
		}
	}
}
