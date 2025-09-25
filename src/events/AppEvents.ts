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
	"content-saved": {
		view: AbstractNoteView;
	};
	"unsaved-state-changed": {
		hasUnsavedChanges: boolean;
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
	"register-new-hot-note": {
		noteGroupId: string;
	};
	"obsidian-layout-changed": void;
	"obsidian-active-leaf-changed": {
		view: AbstractNoteView | null;
	};
	"settings-changed": {
		newSettings: PluginSettings;
	};
}
