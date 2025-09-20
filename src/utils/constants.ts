import { type SandboxNotePluginSettings } from "../settings";
import manifest from "../../manifest.json";

export const DEFAULT_SETTINGS: SandboxNotePluginSettings = {
	logLevel: "info",
	enableSaveNoteContent: false,
	enableUnsafeCtrlS: false,
};

export const APP_NAME = manifest.name || "SandboxNote";
export const VIEW_TYPE = "sandbox-note-view";
export const SANDBOX_NOTE_ICON = "file-text";
