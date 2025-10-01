import log from "loglevel";
import { App, Notice } from "obsidian";
import { showFilePathPrompt } from "src/helpers/interaction";
import type { PluginSettings } from "src/settings";
import type { AbstractNoteView } from "./AbstractNoteView";

const logger = log.getLogger("Utils");

// --- Main Conversion Utility ---
export async function extractToFileInteraction<T extends AbstractNoteView>(
	view: T
) {
	const settings: PluginSettings = view.pluginSettings;

	try {
		const content = view.getContent();
		const baseTitle = "Untitled";

		const sanitizedBasename = sanitizeFilename(baseTitle);
		const suggestedPath = buildSuggestedPath(
			settings.defaultSavePath,
			sanitizedBasename
		);

		const finalFilePath = await resolveFinalPath(
			view.app,
			settings,
			suggestedPath,
			sanitizedBasename
		);

		if (!finalFilePath) {
			new Notice("Conversion cancelled.");
			return;
		}

		view.setContent("");
		await createAndOpenFile(view, finalFilePath, content, baseTitle);
		return true;
	} catch (error: any) {
		handleConversionError(error);
		return false;
	}
}

function sanitizeFilename(filename: string): string {
	return filename.replace(/[\\/:"*?<>|]+/g, "").trim() || "Untitled";
}

function buildSuggestedPath(savePath: string, basename: string): string {
	const normalizedPath =
		savePath && !savePath.endsWith("/") ? `${savePath}/` : savePath;
	return `${normalizedPath}${basename}`;
}

async function resolveFinalPath(
	app: App,
	settings: PluginSettings,
	suggestedPath: string,
	basename: string
): Promise<string | null> {
	if (settings.confirmBeforeSaving) {
		const result = await showFilePathPrompt(app, {
			baseFileName: basename,
			initialPath: suggestedPath,
		});
		return result.fullPath || null;
	}
	return suggestedPath;
}

async function createAndOpenFile<T extends AbstractNoteView>(
	view: T,
	filePath: string,
	content: string,
	baseTitle: string,
	newTab = false
): Promise<void> {
	const availablePath = view.app.vault.getAvailablePath(filePath, "md");
	if (newTab) {
		await view.app.fileManager.createAndOpenMarkdownFile(
			availablePath,
			"tab"
		);
		view.app.workspace.activeEditor?.editor?.setValue(content);
	} else {
		const newFile = await view.app.vault.create(availablePath, content);
		await view.leaf.openFile(newFile);
	}
	new Notice(`${baseTitle} converted to file: ${availablePath}`);
}

function handleConversionError(error: Error): void {
	if (error.message.includes("ENOENT")) {
		new Notice("Failed to convert sandbox: no such file or directory");
		throw error;
	}

	new Notice(
		"Failed to convert sandbox note to file. See console for details.",
		5000
	);
	throw error;
}

export function getSandboxVaultPath() {
	try {
		return require("electron").ipcRenderer.sendSync(
			"get-sandbox-vault-path"
		);
	} catch {
		return undefined;
	}
}
