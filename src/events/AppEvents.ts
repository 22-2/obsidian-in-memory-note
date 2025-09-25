import type { AbstractNoteView } from "../views/internal/AbstractNoteView";
import type { SandboxNoteView } from "../views/SandboxNoteView";

export interface AppEvents {
	"content-changed": {
		content: string;
		sourceView: AbstractNoteView;
	};
	"save-requested": {
		view: AbstractNoteView;
		noteGroupId?: string;
		content?: string;
	};
	"content-saved": void;
	"unsaved-state-changed": {
		hasUnsavedChanges: boolean;
	};
}
