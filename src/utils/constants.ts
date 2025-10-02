// src/utils/constants.ts
import log from "loglevel";

export const DEBUG_MODE =
	typeof process !== "undefined" && process.env.NODE_ENV === "development";

log.debug("ENABLE_LOGGER", DEBUG_MODE);

export const APP_NAME = "HotSandboxNote";
export const VIEW_TYPE_HOT_SANDBOX = "hot-sandbox-note-view";
export const HOT_SANDBOX_NOTE_ICON = "package";

export const HOT_SANDBOX_ID_PREFIX = "hsbox-";

export const DEBOUNCE_MS = 1000;
export const CMD_ID_CONVERT_TO_FILE = "sandbox-note:convert-to-file";
export const CMD_ID_OPEN_HOT_SANDBOX =
	"sandbox-note:open-hot-sandbox-note-view";
export const CMD_ID_TOGGLE_SOURCE = "editor:toggle-source";
export const CMD_ID_CLOSE_TAB = "workspace:close";
export const CMD_ID_UNDO_CLOSE_TAB = "workspace:undo-close-pane";
