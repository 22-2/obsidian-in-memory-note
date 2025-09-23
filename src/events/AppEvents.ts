import type { AbstractNoteView } from "../views/helpers/AbstractNoteView";
import type { SandboxNoteView } from "../views/SandboxNoteView";

export interface AppEvents {
	"content-changed": {
		content: string;
		sourceView: AbstractNoteView;
	};
	"save-requested": {
		view: SandboxNoteView;
	};
	"content-saved": void;
	"unsaved-state-changed": {
		hasUnsavedChanges: boolean;
	};
}
