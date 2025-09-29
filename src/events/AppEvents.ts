import type { PluginSettings } from "src/settings";
import type { AbstractNoteView } from "../views/internal/AbstractNoteView";

export interface AppEvents {
	"editor-content-changed": {
		content: string;
		sourceView: AbstractNoteView;
	};
	"save-requested": {
		view: AbstractNoteView;
	};
	"save-result": {
		view: AbstractNoteView;
		success: boolean;
	};
	"delete-requested": {
		view: AbstractNoteView;
	};
	"view-opened": {
		view: AbstractNoteView;
	};
	"view-closed": {
		view: AbstractNoteView;
	};
	"connect-editor-plugin": {
		view: AbstractNoteView;
	};
	"plugin-unload": void;
	"obsidian-layout-changed": void;
	"obsidian-active-leaf-changed": {
		view: AbstractNoteView | null;
	};
	"obsidian-layout-ready": void;
	"settings-changed": {
		newSettings: PluginSettings;
	};
}
