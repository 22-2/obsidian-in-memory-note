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
	"delete-requested": {
		view: AbstractNoteView;
	};
	"content-saved": {
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
	"obsidian-layout-changed": void;
	"obsidian-active-leaf-changed": {
		view: AbstractNoteView | null;
	};
	"settings-changed": {
		newSettings: PluginSettings;
	};
	"settings-update-requested": {
		settings: PluginSettings;
	};
}
