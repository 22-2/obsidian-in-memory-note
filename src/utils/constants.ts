import { type SandboxNotePluginData, type PluginSettings } from "../settings";
import manifest from "../../manifest.json";

export const DEFAULT_SETTINGS: PluginSettings = {
	enableLogger: false,
	enableAutoSave: true,
	autoSaveDebounceMs: 3000,
	// enableUnsafeCtrlS: false,
	enableCtrlS: false,
};

export const DEFAULT_PLUGIN_DATA: SandboxNotePluginData = {
	settings: DEFAULT_SETTINGS,
	data: {
		noteContent: "",
		lastSaved: "",
		hotSandboxNotes: {},
	},
};

export const APP_NAME = manifest.name || "SandboxNote";
export const VIEW_TYPE_SANDBOX = "sandbox-note-view";
export const VIEW_TYPE_IN_MEMORY = "in-memory-note-view";
export const VIEW_TYPE_HOT_SANDBOX = "hot-sandbox-note-view";
export const SANDBOX_NOTE_ICON = "package";
export const IN_MEMORY_NOTE_ICON = "memory-stick";
export const HOT_SANDBOX_NOTE_ICON = "flame";

export const HOT_SANDBOX_ID_PREFIX = "hsbox-";
