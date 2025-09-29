import log from "loglevel";
import { type PluginSettings, type SandboxNotePluginData } from "../settings";

export const DEBUG_MODE =
	typeof process !== "undefined" && process.env.NODE_ENV === "development";

log.debug("ENABLE_LOGGER", DEBUG_MODE);

export const DEFAULT_SETTINGS: PluginSettings = {
	enableLogger: DEBUG_MODE,
	enableAutoSave: true,
	autoSaveDebounceMs: 3000,
	enableCtrlS: false,
};

export const DEFAULT_PLUGIN_DATA: SandboxNotePluginData = {
	settings: DEFAULT_SETTINGS,
	data: {
		hotSandboxNotes: {},
	},
};

export const APP_NAME = "HotSandboxNote";
export const VIEW_TYPE_HOT_SANDBOX = "hot-sandbox-note-view";
export const HOT_SANDBOX_NOTE_ICON = "flame";

export const HOT_SANDBOX_ID_PREFIX = "hsbox-";
