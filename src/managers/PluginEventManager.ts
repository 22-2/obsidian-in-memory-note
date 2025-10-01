import log from "loglevel";
import type { AppEvents } from "src/events/AppEvents";
import type { CodeMirrorExtensionManager } from "src/managers/CodeMirrorExtensionManager";
import type { DatabaseManager } from "src/managers/DatabaseManager";
import type { IManager } from "src/managers/IManager";
import type { EventEmitter } from "src/utils/EventEmitter";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";
import SandboxPlugin from "../main";
import type { CacheManager } from "./CacheManager";
import type { SettingsManager } from "./SettingsManager";
import type { ViewManager } from "./ViewManager";

const logger = log.getLogger("PluginEventManager");

type Context = {
	saveSandbox: DatabaseManager["debouncedSaveSandboxes"];
	cache: CacheManager;
	emitter: EventEmitter<AppEvents>;
	settings: SettingsManager;
	connectEditorPluginToView: CodeMirrorExtensionManager["connectEditorPluginToView"];
	clearAllDeadSandboxes: DatabaseManager["clearAllDeadSandboxes"];
	getAllViews: ViewManager["getAllViews"];
	// 変更点：新しい依存関係を追加
	isLastHotView: ViewManager["isLastHotView"];
	deleteFromAll: DatabaseManager["deleteFromAll"];
	togglLoggersBy: SandboxPlugin["togglLoggersBy"];
};

export class PluginEventManager implements IManager {
	constructor(private context: Context) {}

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
		this.context.clearAllDeadSandboxes();
	};

	private handleViewClosed = (payload: AppEvents["view-closed"]) => {
		const { view } = payload;
		// 変更点：タブが閉じられたときのロジックを明確化
		if (view instanceof HotSandboxNoteView && view.masterId) {
			// このタブが、特定のノートグループを表示している最後のタブであるかを確認
			if (this.context.isLastHotView(view.masterId)) {
				// 最後のタブであれば、DBとキャッシュから完全にデータを削除する
				this.context.deleteFromAll(view.masterId);
				logger.debug(
					`Last view for group ${view.masterId} closed. Deleting all related data.`
				);
			}
		}
		// 念のため、アクティブなビューを持たないデッドデータをクリーンアップする
		this.context.clearAllDeadSandboxes();
	};

	private handleUnload = () => {
		for (const view of this.context.getAllViews()) {
			view.save();
			this.context.emitter.once("save-result", ({ success, view }) => {
				if (success) {
					view.close();
				} else {
					logger.error("Failed to save view on unload", view);
				}
			});
		}
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
			payload.newSettings.enableLogger ? "debug" : "warn"
		);
		logger.debug("Logger initialized");
	};

	private handleEditorContentChanged = (
		payload: AppEvents["editor-content-changed"]
	) => {
		const { content, sourceView } = payload;

		if (sourceView instanceof HotSandboxNoteView && sourceView.masterId) {
			// インメモリ状態を更新
			this.context.cache.updateNoteContent(sourceView.masterId, content);

			// 自動保存が有効な場合はデバウンス保存
			if (this.context.settings.getSettings().enableAutoSave) {
				const debounceMs =
					this.context.settings.getSettings().autoSaveDebounceMs;
				this.context.saveSandbox(
					sourceView.masterId,
					content,
					debounceMs
				);
			}
		}
	};
}
