import log from "loglevel";
import type { AppEvents } from "src/events/AppEvents";
import type SandboxNotePlugin from "src/main";
import { uniqBy } from "src/utils";
import type { EventEmitter } from "src/utils/EventEmitter";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";
import type { AppOrchestrator } from "./AppOrchestrator";
import type { Manager } from "./Manager";
import type { ViewManager } from "./ViewManager";
import type { CacheManager } from "./CacheManager";

const logger = log.getLogger("EditorSyncManager");

type Context = {
	emitter: EventEmitter<AppEvents>;
	getAllHotSandboxViews: ViewManager["getAllHotSandboxViews"];
	getAllNotes: CacheManager["getAllNotes"];
	registerNewNote: CacheManager["registerNewNote"];
	getNoteContent: CacheManager["getNoteContent"];
};

/** Manages shared content synchronization across views */
export class EditorSyncManager implements Manager {
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
		if (view instanceof HotSandboxNoteView && view.masterNoteId) {
			this.context.registerNewNote(view.masterNoteId);
			this.viewMasterIdMap.set(view, view.masterNoteId);
			view.setContent(this.getNoteContent(view.masterNoteId));
			log.debug(
				`View ${view.leaf.id} associated with masterId ${view.masterNoteId}`
			);
		}
	};

	private handleEditorContentChanged = (
		payload: AppEvents["editor-content-changed"]
	) => {
		const { content, sourceView } = payload;
		console.log("handleEditorContentChanged");

		if (
			sourceView instanceof HotSandboxNoteView &&
			sourceView.masterNoteId
		) {
			this.syncHotViews(sourceView.masterNoteId, content, sourceView);
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

	public getNoteContent(masterNoteId: string): string {
		return this.context.getNoteContent(masterNoteId);
	}

	public syncHotViews(
		masterNoteId: string,
		content: string,
		sourceView: HotSandboxNoteView
	) {
		log.debug(
			`Syncing hot sandbox note content for group: ${masterNoteId}`
		);

		const allViews = this.context.getAllHotSandboxViews();

		for (const view of allViews) {
			// WeakMapからこのビューのmasterIdを取得
			const currentMasterId = this.viewMasterIdMap.get(view);

			// 同期対象のグループに属しており、かつ、変更元のビューではない場合
			if (currentMasterId === masterNoteId && view !== sourceView) {
				view.setContent(content);
			}
		}
	}
}
