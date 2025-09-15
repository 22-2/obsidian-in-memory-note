import { WorkspaceLeaf, type App, type UViewState } from "obsidian";

/**
 * Creates a virtual TFile-like object for in-memory operations.
 * @param app The Obsidian App instance.
 * @returns A virtual file object.
 */
export function createVirtualFile(app: App) {
	const now = new Date().getTime();
	return {
		path: `in-memory-note.md`,
		name: `In-Memory Note.md`,
		basename: `In-Memory Note`,
		extension: "md",
		vault: app.vault,
		// stat is a dummy value
		stat: {
			ctime: now,
			mtime: now,
			size: 0,
		},
	};
}
/**
 * Opens a view in a new tab if it isn't already open.
 * @param app The Obsidian App instance.
 * @param viewState The view state to set for the new leaf.
 * @param eState The ephemeral state to set for the new leaf.
 * @returns The instance of the opened view.
 */
export async function activateView<T = any, U = any>(
	app: App,
	viewState: UViewState,
	eState?: U
): Promise<T> {
	const leaf: WorkspaceLeaf = app.workspace.getLeaf("tab");

	if (viewState) {
		await leaf.setViewState(viewState);
	}
	if (eState) {
		leaf.setEphemeralState(eState);
	}

	return leaf.view as T;
}
