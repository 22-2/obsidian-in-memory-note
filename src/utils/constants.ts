import { type SandboxNotePluginSettings } from "../settings";
import manifest from "../../manifest.json";

export const DEFAULT_SETTINGS: SandboxNotePluginSettings = {
	logLevel: "info",
	enableSaveNoteContent: false,
	autoSaveDebounceMs: 3000,
	enableUnsafeCtrlS: false,
	noteContent: "",
	lastSaved: "",
};

export const APP_NAME = manifest.name || "SandboxNote";
export const VIEW_TYPE_SANDBOX = "sandbox-note-view";
export const VIEW_TYPE_IN_MEMORY = "in-memory-note-view";
export const SANDBOX_NOTE_ICON = "file-text";
export const IN_MEMORY_NOTE_ICON = "file-edit";
