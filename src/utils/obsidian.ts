import {
	WorkspaceLeaf,
	WorkspaceParent,
	WorkspaceWindow,
	type App,
	type UViewState,
} from "obsidian";

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

/**
 * Gets all active workspace leaves (panes)
 * @param app - Obsidian app
 * @returns An array of all workspace leaves
 */
export function getAllLeaves(app: App): WorkspaceLeaf[] {
	const leaves: WorkspaceLeaf[] = [];
	app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
		leaves.push(leaf);
	});
	return leaves;
}

/**
 * Retrieves workspace items of a specific type from all workspace leaves.
 *
 * @param app The application instance.
 * @param getItem A function that takes a workspace leaf and returns the workspace item or null/undefined if not found.
 * @returns An array of workspace items of type T.
 * @template T - The type of workspace item, must be either WorkspaceWindow or WorkspaceParent.
 */
function getWorkspaceItems<T extends WorkspaceWindow | WorkspaceParent>(
	app: App,
	getItem: (leaf: WorkspaceLeaf) => T | null | undefined
): T[] {
	const itemMap = new Map<string, T>();
	getAllLeaves(app).forEach((leaf) => {
		const item = getItem(leaf);
		if (item && item.id) {
			itemMap.set(item.id, item);
		}
	});
	return Array.from(itemMap.values()) as T[];
}

/**
 * Gets all workspace windows
 * @param app - Obsidian app
 * @returns An array of all workspace windows
 */
export function getAllWorkspaceWindows(app: App): WorkspaceWindow[] {
	return getWorkspaceItems<WorkspaceWindow>(app, (leaf) =>
		leaf.getContainer()
	);
}
