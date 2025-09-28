import { type SandboxNotePluginData, type PluginSettings } from "../settings";
import log from "loglevel";

const ENABLE_LOGGER =
	typeof process !== "undefined" && process.env.NODE_ENV === "development";

log.debug("ENABLE_LOGGER", ENABLE_LOGGER);

export const DEFAULT_SETTINGS: PluginSettings = {
	enableLogger: ENABLE_LOGGER,
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
