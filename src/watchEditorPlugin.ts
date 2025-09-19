import {
	ViewUpdate,
	type PluginValue,
	EditorView,
	ViewPlugin,
} from "@codemirror/view";
import { debounce } from "obsidian";
import type InMemoryNotePlugin from "./main";
import type { InMemoryNoteView } from "./view";

export class EditorPlugin implements PluginValue {
	private plugin: InMemoryNotePlugin | null = null;
	private sourceView: InMemoryNoteView | null = null;

	setNoteContent(content: string) {
		if (this.plugin && this.sourceView) {
			this.plugin.updateNoteContent(content, this.sourceView);
		}
	}

	update(update: ViewUpdate): void {
		if (!this.plugin || !this.sourceView) {
			return;
		}

		// Process only when document has changed
		if (update.docChanged) {
			const newContent = update.state.doc.toString();
			this.setNoteContent(newContent);
		}
	}

	connectToPlugin(
		plugin: InMemoryNotePlugin,
		sourceView: InMemoryNoteView
	): void {
		this.plugin = plugin;
		this.sourceView = sourceView;
	}

	destroy(): void {
		this.plugin = null;
		this.sourceView = null;
	}
}

export const watchEditorPlugin = ViewPlugin.fromClass(EditorPlugin);
