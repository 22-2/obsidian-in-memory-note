import "obsidian";
import "obsidian-typings";

declare module "obsidian" {
	interface UViewState extends ViewState {
		type: string; // The type of the view (e.g., "markdown", "canvas", "empty").
		state?: any; // View-specific state data (e.g., file path, edit mode for Markdown view).
		icon?: string; // Icon for the new view (for placeholder views).
		title?: string; // Title for the new view (for placeholder views).
		active?: boolean; // Whether to make this view active.
		group?: WorkspaceLeaf; // The group this view belongs to.
		popstate?: boolean; // Whether this is from a browser history navigation.
		sync?: boolean; // Whether state synchronization is needed.
	}

	interface Workspace {
		// setViewState(state: UViewState, result: ViewStateResult): Promise<void>;
		_activeEditor: MarkdownView | null;
	}
}
