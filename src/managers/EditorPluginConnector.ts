import type SandboxNotePlugin from "src/main";
import { syncEditorPlugin } from "src/views/helpers/SyncEditorPlugin";
import type { EventEmitter } from "src/utils/EventEmitter";
import type { AppEvents } from "src/events/AppEvents";
import type { AbstractNoteView } from "src/views/helpers/AbstractNoteView";

/** Manages editor extensions and plugin connections */
export class EditorPluginConnector {
	private plugin: SandboxNotePlugin;
	private emitter: EventEmitter<AppEvents>;

	/** CodeMirror plugin for watching changes */
	watchEditorPlugin = syncEditorPlugin;

	constructor(plugin: SandboxNotePlugin, emitter: EventEmitter<AppEvents>) {
		this.plugin = plugin;
		this.emitter = emitter;
	}

	/** Register editor extension for watching changes */
	setupEditorExtension() {
		this.plugin.registerEditorExtension(syncEditorPlugin);
	}

	/** Connect watch editor plugin to view */
	connectEditorPluginToView(view: AbstractNoteView) {
		if (!view.editor) return;
		const editorPlugin = view.editor.cm.plugin(syncEditorPlugin);
		if (editorPlugin) {
			editorPlugin.connectToPlugin(this.plugin, view, this.emitter);
		}
	}
}
