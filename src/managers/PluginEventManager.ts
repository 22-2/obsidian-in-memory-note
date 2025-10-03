import log from "loglevel";
import type { AppEvents } from "src/events/AppEvents";
import type { CodeMirrorExtensionManager } from "src/managers/CodeMirrorExtensionManager";
import type { DatabaseManager } from "src/managers/DatabaseManager";
import type { IManager } from "src/managers/IManager";
import type { EventEmitter } from "src/utils/EventEmitter";
import { DEBOUNCE_MS } from "src/utils/constants";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";
import SandboxPlugin from "../main";
import type { CacheManager } from "./CacheManager";
import type { SettingsManager } from "./SettingsManager";
import type { ViewManager } from "./ViewManager";

const logger = log.getLogger("PluginEventManager");

type Context = {
	saveSandbox: DatabaseManager["debouncedSaveSandboxes"];
	immediateSave: DatabaseManager["immediateSave"];
	cache: CacheManager;
	emitter: EventEmitter<AppEvents>;
	settings: SettingsManager;
	connectEditorPluginToView: CodeMirrorExtensionManager["connectEditorPluginToView"];
	clearOldDeadSandboxes: DatabaseManager["clearOldDeadSandboxes"];
	getAllViews: ViewManager["getAllViews"];
	isLastHotView: ViewManager["isLastHotView"];
	deleteFromAll: DatabaseManager["deleteFromAll"];
	togglLoggersBy: SandboxPlugin["togglLoggersBy"];
};

export class PluginEventManager implements IManager {
	constructor(private context: Context) { }

	load(): void {
		this.context.emitter.on(
			"editor-content-changed",
			this.handleEditorContentChanged
		);
		this.context.emitter.on(
			"connect-editor-plugin",
			this.handleConnectEditorPlugin
		);
		this.context.emitter.on("settings-changed", this.handleSettingsChanged);
		this.context.emitter.on("view-closed", this.handleViewClosed);
		this.context.emitter.on(
			"obsidian-layout-ready",
			this.handleLayoutReady
		);
		this.context.emitter.on("plugin-unload", this.handleUnload);
		this.handleSettingsChanged({
			newSettings: this.context.settings.getSettings(),
		});
	}

	unload(): void {
		this.context.emitter.off(
			"editor-content-changed",
			this.handleEditorContentChanged
		);
		this.context.emitter.off(
			"connect-editor-plugin",
			this.handleConnectEditorPlugin
		);
		this.context.emitter.off(
			"settings-changed",
			this.handleSettingsChanged
		);
	}

	private handleLayoutReady = () => {
		this.context.clearOldDeadSandboxes();
	};

	private handleViewClosed = async (payload: AppEvents["view-closed"]) => {
		const { view } = payload;
		// 変更点：タブが閉じられたときのロジックを明確化
		if (view instanceof HotSandboxNoteView && view.masterId) {
			// このタブが、特定のノートグループを表示している最後のタブであるかを確認
			if (this.context.isLastHotView(view.masterId)) {
				// 最後のタブであれば、まず即座に保存してからDBとキャッシュから完全にデータを削除する
				try {
					logger.debug(`Immediate save before closing last view for: ${view.masterId}`);
					await this.context.immediateSave(view.masterId, view.getContent());
					logger.debug(`Immediate save completed for: ${view.masterId}`);
				} catch (error) {
					logger.warn(`Failed to immediately save before closing view: ${view.masterId}`, error);
				}

				this.context.deleteFromAll(view.masterId);
				logger.debug(
					`Last view for group ${view.masterId} closed. Deleting all related data.`
				);
			}
		}
	};

	private handleUnload = async () => {
		const views = this.context.getAllViews();
		logger.debug(`Plugin unload: immediately saving ${views.length} views`);

		// Immediately save all views before unload
		const savePromises = views
			.filter(view => view instanceof HotSandboxNoteView && view.masterId)
			.map(async (view) => {
				const hotView = view as HotSandboxNoteView;
				try {
					logger.debug(`Immediate save on unload for: ${hotView.masterId}`);
					await this.context.immediateSave(hotView.masterId!, hotView.getContent());
					logger.debug(`Immediate save completed on unload for: ${hotView.masterId}`);
				} catch (error) {
					logger.warn(`Failed to immediately save on unload: ${hotView.masterId}`, error);
				}
			});

		await Promise.all(savePromises);
		logger.debug("All immediate saves completed on unload");
	};

	private handleConnectEditorPlugin = (
		payload: AppEvents["connect-editor-plugin"]
	) => {
		this.context.connectEditorPluginToView(payload.view);
	};

	private handleSettingsChanged = (
		payload: AppEvents["settings-changed"]
	) => {
		this.context.togglLoggersBy(
			payload.newSettings["advanced.enableLogger"] ? "debug" : "warn"
		);
		logger.debug("Logger initialized");
	};

	private handleEditorContentChanged = (
		payload: AppEvents["editor-content-changed"]
	) => {
		const { content, sourceView } = payload;

		if (sourceView instanceof HotSandboxNoteView && sourceView.masterId) {
			// インメモリ状態を更新
			this.context.cache.updateSandboxContent(
				sourceView.masterId,
				content
			);

			this.context.saveSandbox(sourceView.masterId, content, DEBOUNCE_MS);
		}
	};
}
