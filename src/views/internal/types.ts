export interface ObsidianViewState<T = any> {
	mode: "source" | "preview";
	source: boolean;
	backlinkOpts: any;
	backlinks: boolean;
	state: T;

	// for obsidian api compatibility
	[key: string]: any;
}

export interface AbstractNoteViewState
	extends ObsidianViewState<{ content: string; masterId: string }> {
	type: string;
}
