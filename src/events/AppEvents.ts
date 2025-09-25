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
}
