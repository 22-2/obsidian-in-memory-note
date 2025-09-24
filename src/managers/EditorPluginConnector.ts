import type SandboxNotePlugin from "src/main";
import { syncEditorPlugin } from "src/views/internal/SyncEditorPlugin";
import type { EventEmitter } from "src/utils/EventEmitter";
import type { AppEvents } from "src/events/AppEvents";
import type { AbstractNoteView } from "src/views/internal/AbstractNoteView";
import type { Manager } from "./Manager";

/** Manages editor extensions and plugin connections */
export class EditorPluginConnector implements Manager {
	private plugin: SandboxNotePlugin;
	private emitter: EventEmitter<AppEvents>;

	/** CodeMirror plugin for watching changes */
	watchEditorPlugin = syncEditorPlugin;

	constructor(plugin: SandboxNotePlugin, emitter: EventEmitter<AppEvents>) {
		this.plugin = plugin;
		this.emitter = emitter;
	}

	/** Register editor extension for watching changes */
	public load() {
		this.plugin.registerEditorExtension(syncEditorPlugin);
	}

	/**
	 * Unload the editor extension.
	 * Obsidian's API does not provide a direct way to unregister editor extensions.
	 * They are automatically cleaned up when the plugin is unloaded.
	 */
	public unload() {
		// Nothing to do here
	}

	/** Connect watch editor plugin to view */
	connectEditorPluginToView(view: AbstractNoteView) {
		if (!view?.editor) return;
		const editorPlugin = view.editor.cm.plugin(syncEditorPlugin);
		if (editorPlugin) {
			editorPlugin.connectToPlugin(this.plugin, view, this.emitter);
		}
	}
}
