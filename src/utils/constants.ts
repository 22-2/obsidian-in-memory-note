import { type InMemoryNotePluginSettings } from "../settings";
import manifest from "../../manifest.json";

export const DEFAULT_SETTINGS: InMemoryNotePluginSettings = {
	logLevel: "info",
	enableSaveNoteContent: false,
};

export const APP_NAME = manifest.name || "InMemoryNote";
export const VIEW_TYPE = "in-memory-note-view";
export const IN_MEMORY_NOTE_ICON = "file-text";
