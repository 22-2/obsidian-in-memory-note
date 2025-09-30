import {
	AbstractInputSuggest,
	App,
	Modal,
	Notice,
	Setting,
	TAbstractFile,
	TFolder,
} from "obsidian";

/**
 * Generic confirmation modal utility
 */
export function showConfirmModal(
	app: App,
	title: string,
	message: string
): Promise<boolean> {
	return new Promise((resolve) => {
		new ConfirmModal(app, title, message, resolve).open();
	});
}

/**
 * Confirmation modal implementation
 */
export class ConfirmModal extends Modal {
	constructor(
		app: App,
		private title: string,
		private message: string,
		private callback: (result: boolean) => void
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: this.title });
		contentEl.createEl("p", { text: this.message });

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Yes")
					.setCta()
					.onClick(() => {
						this.callback(true);
						this.close();
					})
			)
			.addButton((btn) =>
				btn.setButtonText("No").onClick(() => {
					this.callback(false);
					this.close();
				})
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/**
 * Base class for path suggestion utilities
 */
abstract class PathSuggest<
	T extends TAbstractFile
> extends AbstractInputSuggest<T> {
	constructor(app: App, protected inputEl: HTMLInputElement) {
		super(app, inputEl);
	}

	protected normalizeQuery(query: string): string {
		return query.toLowerCase().replace(/^\//, "").replace(/\/$/, "");
	}

	protected formatPath(path: string, isRoot?: boolean): string {
		return path === "" || isRoot ? "Vault Root /" : path;
	}

	selectSuggestion(item: T): void {
		const selectedPath = this.formatSelectedPath(item.path);
		this.inputEl.value = selectedPath;
		this.inputEl.trigger("input");
		this.inputEl.trigger("change");
		this.close();
	}

	protected abstract formatSelectedPath(path: string): string;
}

/**
 * Suggests existing folder paths within the vault
 */
export class FolderSuggest extends PathSuggest<TFolder> {
	getSuggestions(query: string): TFolder[] {
		// @ts-expect-error - Creating root folder instance
		const allFolders: TFolder[] = [new TFolder(this.app.vault, "/")].concat(
			this.app.vault.getAllFolders()
		);

		const normalizedQuery = this.normalizeQuery(query);

		return allFolders.filter((folder) => {
			const displayPath = this.formatPath(folder.path);
			return displayPath.toLowerCase().includes(normalizedQuery);
		});
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		const pathText = this.formatPath(folder.path);
		el.createEl("div", { text: pathText });
		el.addClass("mod-folder");
	}

	protected formatSelectedPath(path: string): string {
		// Empty string for root, otherwise ensure trailing slash
		return path ? (path.endsWith("/") ? path : `${path}/`) : "";
	}
}

/**
 * Suggests existing file paths within the vault
 */
// export class FileSuggest extends PathSuggest<TFile> {
// 	constructor(
// 		app: App,
// 		inputEl: HTMLInputElement,
// 		private fileExtension?: string
// 	) {
// 		super(app, inputEl);
// 	}

// 	getSuggestions(query: string): TFile[] {
// 		const allFiles = this.app.vault.getFiles();
// 		const normalizedQuery = this.normalizeQuery(query);

// 		return allFiles.filter((file) => {
// 			// Filter by extension if specified
// 			if (this.fileExtension && !file.path.endsWith(this.fileExtension)) {
// 				return false;
// 			}

// 			return file.path.toLowerCase().includes(normalizedQuery);
// 		});
// 	}

// 	renderSuggestion(file: TFile, el: HTMLElement): void {
// 		el.createEl("div", { text: file.path });
// 		el.addClass("mod-file");
// 	}

// 	protected formatSelectedPath(path: string): string {
// 		return path; // Files don't need trailing slash
// 	}
// }

/**
 * Combined folder and file suggestion utility
 */
// export class FileChooserSuggest extends AbstractInputSuggest<TAbstractFile> {
// 	constructor(
// 		app: App,
// 		protected inputEl: HTMLInputElement,
// 		private options: {
// 			showFolders?: boolean;
// 			showFiles?: boolean;
// 			fileExtension?: string;
// 		} = {}
// 	) {
// 		super(app, inputEl);
// 		this.options = {
// 			showFolders: true,
// 			showFiles: true,
// 			...options,
// 		};
// 	}

// 	getSuggestions(query: string): TAbstractFile[] {
// 		const items: TAbstractFile[] = [];
// 		const normalizedQuery = query
// 			.toLowerCase()
// 			.replace(/^\//, "")
// 			.replace(/\/$/, "");

// 		// Add folders if enabled
// 		if (this.options.showFolders) {
// 			const folders: TFolder[] = [
// 				// @ts-expect-error - Creating root folder instance
// 				new TFolder(this.app.vault, "/"),
// 			].concat(this.app.vault.getAllFolders());

// 			items.push(
// 				...folders.filter((f) => {
// 					const displayPath = f.path === "" ? "Vault Root /" : f.path;
// 					return displayPath.toLowerCase().includes(normalizedQuery);
// 				})
// 			);
// 		}

// 		// Add files if enabled
// 		if (this.options.showFiles) {
// 			const files = this.app.vault.getFiles().filter((file) => {
// 				// Filter by extension if specified
// 				if (
// 					this.options.fileExtension &&
// 					!file.path.endsWith(this.options.fileExtension)
// 				) {
// 					return false;
// 				}

// 				return file.path.toLowerCase().includes(normalizedQuery);
// 			});

// 			items.push(...files);
// 		}

// 		// Sort: folders first, then files
// 		return items.sort((a, b) => {
// 			if (a instanceof TFolder && b instanceof TFile) return -1;
// 			if (a instanceof TFile && b instanceof TFolder) return 1;
// 			return a.path.localeCompare(b.path);
// 		});
// 	}

// 	renderSuggestion(item: TAbstractFile, el: HTMLElement): void {
// 		if (item instanceof TFolder) {
// 			const pathText = item.path === "" ? "Vault Root /" : item.path;
// 			el.createEl("div", { text: pathText });
// 			el.addClass("mod-folder");
// 		} else if (item instanceof TFile) {
// 			el.createEl("div", { text: item.path });
// 			el.addClass("mod-file");
// 		}
// 	}

// 	selectSuggestion(item: TAbstractFile): void {
// 		let selectedPath: string;

// 		if (item instanceof TFolder) {
// 			// Folders: ensure trailing slash (empty for root)
// 			selectedPath = item.path
// 				? item.path.endsWith("/")
// 					? item.path
// 					: `${item.path}/`
// 				: "";
// 		} else {
// 			// Files: no trailing slash
// 			selectedPath = item.path;
// 		}

// 		this.inputEl.value = selectedPath;
// 		this.inputEl.trigger("input");
// 		this.inputEl.trigger("change");
// 		this.close();
// 	}
// }

type FilePathPromptModalOptions = {
	baseFileName: string;
	initialPath?: string;
};

type FilePathPromptModalResult = {
	fullPath: string | null;
	baseFileName: string | null;
	resolved: boolean;
};

class FilePathPromptModal extends Modal {
	folderPath: string; // The destination folder path
	fileName: string; // The file name (without extension)
	baseFileName: string; // The original note name (for display)
	resolve: (path: FilePathPromptModalResult) => void = () => {};
	private resolved: boolean = false; // Flag to track if the promise has been resolved

	constructor(
		app: App,
		{ baseFileName, initialPath = "/" }: FilePathPromptModalOptions
	) {
		super(app);
		this.baseFileName = baseFileName;

		// Split initialPath into folderPath and fileName
		const lastSlashIndex = initialPath.lastIndexOf("/");
		if (lastSlashIndex === -1) {
			// If there's no slash, assume the path is just a filename
			this.folderPath = "";
			this.fileName = initialPath;
		} else {
			this.folderPath = initialPath.substring(0, lastSlashIndex);
			this.fileName = initialPath.substring(lastSlashIndex + 1);
		}
	}

	submit() {
		// If the filename is empty, prevent saving
		if (!this.fileName) {
			new Notice("File name cannot be empty.");
			return;
		}

		this.resolved = true;
		this.close();

		// Combine folder path and file name to create the full path
		// Remove trailing slash from folderPath to be safe
		const cleanFolderPath = this.folderPath.replace(/\/$/, "");
		const resultPath = cleanFolderPath
			? `${cleanFolderPath}/${this.fileName}`
			: this.fileName;

		this.resolve({
			fullPath: resultPath,
			baseFileName: this.baseFileName,
			resolved: true,
		});
	}

	onKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			this.submit();
		}
	}

	onOpen() {
		const { contentEl, titleEl } = this;
		titleEl.setText("Confirm Save Location");

		contentEl.createEl("p", {
			text: `Converting note: "${this.baseFileName}"`,
		});

		// Setting for the file name
		new Setting(contentEl)
			.setName("File Name")
			.setDesc(
				"Enter the file name. The .md extension will be added automatically."
			)
			.addText((text) => {
				text.setPlaceholder("e.g., My Scratchpad")
					.setValue(this.fileName)
					.onChange((value) => {
						this.fileName = value.trim();
					});
				text.inputEl.addEventListener("keydown", (e) =>
					this.onKeydown(e)
				);
			});

		// Setting for the destination folder
		new Setting(contentEl)
			.setName("Folder Path")
			.setDesc(
				"Enter the desired folder path. Leave empty to save in the vault root."
			)
			.addSearch((search) => {
				search
					.setPlaceholder("e.g., Notes/Daily")
					.setValue(this.folderPath)
					.onChange((value) => {
						this.folderPath = value.trim();
					});
				search.inputEl.addEventListener("keydown", (e) =>
					this.onKeydown(e)
				);
				new FolderSuggest(this.app, search.inputEl);
			});

		// Add buttons
		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Save")
					.setCta()
					.onClick(() => this.submit())
			)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => {
					this.resolved = true;
					this.close();
					this.resolve({
						fullPath: null,
						baseFileName: null,
						resolved: false,
					});
				})
			);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();

		// If the modal is closed via ESC key or the close button,
		// resolve with 'false' if it hasn't been resolved yet
		if (!this.resolved) {
			this.resolve({
				fullPath: null,
				baseFileName: null,
				resolved: false,
			});
		}
	}

	public async waitForResult(): Promise<FilePathPromptModalResult> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}
}

export async function showFilePathPrompt(
	app: App,
	options: FilePathPromptModalOptions
): Promise<FilePathPromptModalResult> {
	return new FilePathPromptModal(app, options).waitForResult();
}
