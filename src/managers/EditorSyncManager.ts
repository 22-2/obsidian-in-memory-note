import log from "loglevel";
import type { AppEvents } from "src/events/AppEvents";
import type SandboxNotePlugin from "src/main";
import { uniqBy } from "src/utils";
import type { EventEmitter } from "src/utils/EventEmitter";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";
import type { AppOrchestrator } from "./AppOrchestrator";
import type { Manager } from "./Manager";

const logger = log.getLogger("EditorSyncManager");

/** Manages shared content synchronization across views */
export class EditorSyncManager implements Manager {
	private emitter: EventEmitter<AppEvents>;
	private stateManager: AppOrchestrator;
	private plugin: SandboxNotePlugin;

	// --- For new HotSandboxNoteView ---
	private viewMasterIdMap = new WeakMap<HotSandboxNoteView, string>();

	constructor(
		emitter: EventEmitter<AppEvents>,
		stateManager: AppOrchestrator,
		plugin: SandboxNotePlugin
	) {
		this.emitter = emitter;
		this.stateManager = stateManager;
		this.plugin = plugin;
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
		const allViews = this.plugin.getAllHotSandboxViews();
		const map = Object.groupBy(allViews, (view) => view.masterNoteId!);
		return map[masterNoteId]?.length === 1;
	}

	private handleViewOpened = (payload: AppEvents["view-opened"]) => {
		const { view } = payload;
		if (view instanceof HotSandboxNoteView && view.masterNoteId) {
			this.stateManager.registerNewNote(view.masterNoteId);
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

	public indexOfMasterId(masterNoteId: string): number {
		const masterNotes = uniqBy(
			this.stateManager.getAllNotes(),
			(n) => n.id
		);
		return masterNotes.findIndex((note) => note.id === masterNoteId);
	}

	refreshAllViewTitles() {
		logger.debug("refreshAllViewTitles", this.viewMasterIdMap);
		const allViews = this.plugin.getAllHotSandboxViews();
		for (const view of allViews) {
			logger.debug("Updating header for view", view);
			view.leaf.updateHeader();
		}
		logger.debug("finish");
	}

	public getNoteContent(masterNoteId: string): string {
		return this.stateManager.getNoteContent(masterNoteId);
	}

	public syncHotViews(
		masterNoteId: string,
		content: string,
		sourceView: HotSandboxNoteView
	) {
		log.debug(
			`Syncing hot sandbox note content for group: ${masterNoteId}`
		);

		const allViews = this.plugin.getAllHotSandboxViews();

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
