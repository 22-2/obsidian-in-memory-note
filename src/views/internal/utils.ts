import { Notice } from "obsidian";
import type { AbstractNoteView } from "./AbstractNoteView";
import log from "loglevel";

export async function convertToFileAndClear<T extends AbstractNoteView>(
	view: T
) {
	try {
		const content = view.getContent();
		const baseTitle = view.getBaseTitle();

		// Sanitize title to create a valid filename
		const sanitizedTitle =
			baseTitle.replace(/[\\/:"*?<>|]+/g, "").trim() || "Untitled";

		// Determine the folder for the new file, respecting Obsidian's settings
		const parentFolder = view.app.fileManager.getNewFileParent("");

		let initialPath: string;
		if (parentFolder.isRoot()) {
			initialPath = `${sanitizedTitle}.md`;
		} else {
			initialPath = `${parentFolder.path}/${sanitizedTitle}.md`;
		}

		// Find an available path to avoid overwriting existing files
		const filePath = view.app.vault.getAvailablePath(initialPath, "md");

		// Create the new file in the vault
		const newFile = await view.app.vault.create(filePath, content);

		// Open the new file in the current leaf, replacing this view
		await view.leaf.openFile(newFile);

		// Show a confirmation notice
		new Notice(`${baseTitle} converted to file: ${newFile.path}`);

		view.setContent("");
	} catch (error) {
		log.error("Sandbox Note: Failed to convert to file.", error);
	}
}
