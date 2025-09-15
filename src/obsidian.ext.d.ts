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
	// [画面表示と状態更新機能 | Google AI Studio](https://aistudio.google.com/prompts/1BgQr6pov--L2jayg-Vi0TiFMtZ85ku4K?save=true)

	interface WorkspaceLeaf {
		setViewState(state: UViewState): Promise<void>;
	}
}
