import { WorkspaceLeaf } from "obsidian";
import { IN_MEMORY_NOTE_ICON, VIEW_TYPE_IN_MEMORY } from "src/utils/constants";
import type SandboxNotePlugin from "../main";
import { AbstractNoteView } from "./helpers/AbstractNoteView";

/** View for an in-memory, non-persistent note. */
export class InMemoryNoteView extends AbstractNoteView {
	constructor(leaf: WorkspaceLeaf, plugin: SandboxNotePlugin) {
		super(leaf, plugin);
	}

	/** Get view type. */
	getViewType() {
		return VIEW_TYPE_IN_MEMORY;
	}

	/** Get the base title for the view. */
	getBaseTitle(): string {
		return "In-Memory Note";
	}

	/** In-memory notes are never considered "unsaved". */
	get hasUnsavedChanges(): boolean {
		return false;
	}

	/** Get the icon for the view. */
	override getIcon(): string {
		return IN_MEMORY_NOTE_ICON;
	}

	/** Each in-memory view starts with a blank slate. */
	async loadInitialContent(): Promise<string> {
		return "";
	}

	/** In-memory notes are not saved, so this is a no-op. */
	async save(): Promise<void> {
		// Do nothing.
	}
}
