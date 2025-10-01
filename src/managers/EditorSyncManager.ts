import log from "loglevel";
import type { AppEvents } from "src/events/AppEvents";
import type { EventEmitter } from "src/utils/EventEmitter";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";
import { AbstractNoteView } from "src/views/internal/AbstractNoteView";
import type { CacheManager } from "./CacheManager";
import type { IManager } from "./IManager";
import type { ViewManager } from "./ViewManager";

const logger = log.getLogger("EditorSyncManager");

type Context = {
	emitter: EventEmitter<AppEvents>;
	getAllHotSandboxViews: ViewManager["getAllViews"];
	getAllNotes: CacheManager["getAllSandboxes"];
	registerNewNote: CacheManager["registerNewNote"];
	getNoteContent: CacheManager["getNoteContent"];
	getActiveView: ViewManager["getActiveView"];
	workspace: {
		_activeEditor: never;
	};
};

/** Manages shared content synchronization across views */
export class EditorSyncManager implements IManager {
	// --- For new HotSandboxNoteView ---
	private viewMasterIdMap = new WeakMap<HotSandboxNoteView, string>();

	constructor(private context: Context) {}

	public load(): void {
		this.context.emitter.on(
			"editor-content-changed",
			this.handleEditorContentChanged
		);
		this.context.emitter.on("view-opened", this.handleViewOpened);
		this.context.emitter.on("settings-changed", this.handleSettingsChanged);
		// this.context.emitter.on(
		// 	"obsidian-active-leaf-changed",
		// 	this.syncActiveEditorState
		// );
	}

	public unload(): void {
		this.context.emitter.off(
			"editor-content-changed",
			this.handleEditorContentChanged
		);
		this.context.emitter.off("view-opened", this.handleViewOpened);
		this.context.emitter.off(
			"settings-changed",
			this.handleSettingsChanged
		);
	}

	private handleSettingsChanged = () => {
		this.refreshAllViewTitles();
	};

	private handleViewOpened = (payload: AppEvents["view-opened"]) => {
		const { view } = payload;
		if (view instanceof HotSandboxNoteView && view.masterId) {
			this.context.registerNewNote(view.masterId);
			this.viewMasterIdMap.set(view, view.masterId);
			view.setContent(this.getNoteContent(view.masterId));
			log.debug(
				`View ${view.leaf.id} associated with masterId ${view.masterId}`
			);
		}
	};

	private handleEditorContentChanged = (
		payload: AppEvents["editor-content-changed"]
	) => {
		const { content, sourceView } = payload;
		logger.debug("handleEditorContentChanged");

		if (sourceView instanceof HotSandboxNoteView && sourceView.masterId) {
			this.syncHotViews(sourceView.masterId, content, sourceView);
		}

		this.refreshAllViewTitles();
	};

	refreshAllViewTitles() {
		logger.debug("refreshAllViewTitles", this.viewMasterIdMap);
		const allViews = this.context.getAllHotSandboxViews();
		for (const view of allViews) {
			logger.debug("Updating header for view", view);
			view.leaf.updateHeader();
		}
		logger.debug("finish");
	}

	public getNoteContent(masterId: string): string {
		return this.context.getNoteContent(masterId);
	}

	public syncHotViews(
		masterId: string,
		content: string,
		sourceView: HotSandboxNoteView
	) {
		log.debug(`Syncing hot sandbox note content for group: ${masterId}`);

		const allViews = this.context.getAllHotSandboxViews();

		for (const view of allViews) {
			// WeakMapからこのビューのmasterIdを取得
			const currentMasterId = this.viewMasterIdMap.get(view);

			// 同期対象のグループに属しており、かつ、変更元のビューではない場合
			if (currentMasterId === masterId && view !== sourceView) {
				view.setContent(content);
			}
		}
	}
}
