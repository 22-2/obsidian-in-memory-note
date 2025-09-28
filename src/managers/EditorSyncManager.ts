import log from "loglevel";
import type { AbstractNoteView } from "src/views/internal/AbstractNoteView";
import type { EventEmitter } from "src/utils/EventEmitter";
import type { AppEvents } from "src/events/AppEvents";
import type { Manager } from "./Manager";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";
import type { StateManager } from "./StateManager";
import { uniqBy } from "src/utils";
import { nanoid } from "nanoid";
import { HOT_SANDBOX_ID_PREFIX } from "src/utils/constants";
import { issue1Logger, issue2Logger } from "../special-loggers";

const logger = log.getLogger("EditorSyncManager");

/** Manages shared content synchronization across views */
export class EditorSyncManager implements Manager {
	private emitter: EventEmitter<AppEvents>;
	private stateManager: StateManager;

	// --- For new HotSandboxNoteView ---
	private viewMasterIdMap = new WeakMap<HotSandboxNoteView, string>();

	constructor(
		emitter: EventEmitter<AppEvents>,
		stateManager: StateManager,
		private funcs: { getAllHotSandboxViews: () => HotSandboxNoteView[] }
	) {
		this.emitter = emitter;
		this.stateManager = stateManager;
	}

	public load(): void {
		this.emitter.on(
			"editor-content-changed",
			this.handleEditorContentChanged
		);
		this.emitter.on("view-opened", this.handleViewOpened);
		this.emitter.on("settings-changed", this.handleSettingsChanged);
	}

	public unload(): void {
		this.emitter.off(
			"editor-content-changed",
			this.handleEditorContentChanged
		);
		this.emitter.off("view-opened", this.handleViewOpened);
		this.emitter.off("settings-changed", this.handleSettingsChanged);
	}

	private handleSettingsChanged = () => {
		this.refreshAllViewTitles();
	};

	public isLastHotView(masterNoteId: string) {
		const allViews = this.funcs.getAllHotSandboxViews();
		const map = Object.groupBy(allViews, (view) => view.masterNoteId!);
		return map[masterNoteId]?.length === 1;
	}

	private handleViewOpened = (payload: AppEvents["view-opened"]) => {
		const { view } = payload;
		issue1Logger.debug("EditorSyncManager.handleViewOpened", view);
		logger.debug("handleViewOpened", view);
		logger.debug("handleViewOpened.getState", view.getState());
		if (view instanceof HotSandboxNoteView && view.masterNoteId) {
			this.viewMasterIdMap.set(view, view.masterNoteId);
			view.setContent(this.getHotNoteContent(view.masterNoteId));
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

	public indexOfMasterId(masterNoteId: string): number {
		const masterNotes = uniqBy(
			this.stateManager.getAllHotNotes(),
			(n) => n.id
		);
		return masterNotes.findIndex((note) => note.id === masterNoteId);
	}

	refreshAllViewTitles() {
		logger.debug("refreshAllViewTitles", this.viewMasterIdMap);
		const allViews = this.funcs.getAllHotSandboxViews();
		for (const view of allViews) {
			logger.debug("Updating header for view", view);
			view.leaf.updateHeader();
		}
		logger.debug("finish");
	}

	public getHotNoteContent(masterNoteId: string): string {
		return this.stateManager.getHotNoteContent(masterNoteId);
	}

	public syncHotViews(
		masterNoteId: string,
		content: string,
		sourceView: HotSandboxNoteView
	) {
		log.debug(
			`Syncing hot sandbox note content for group: ${masterNoteId}`
		);

		const allViews = this.funcs.getAllHotSandboxViews();

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
