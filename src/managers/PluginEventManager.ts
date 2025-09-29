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
	applyLogger: SandboxPlugin["applyLogger"];
	cache: CacheManager;
	emitter: EventEmitter<AppEvents>;
	settings: SettingsManager;
	connectEditorPluginToView: CodeMirrorExtensionManager["connectEditorPluginToView"];
	clearAllDeadSandboxes: DatabaseManager["clearAllDeadSandboxes"];
	getAllViews: ViewManager["getAllViews"];
};

export class PluginEventManager implements IManager {
	constructor(private context: Context) {}

	load(): void {
		this.context.emitter.on(
			"editor-content-changed",
			this.handleEditorContentChanged
		);
		this.context.emitter.on(
			"settings-update-requested",
			this.handleSettingsUpdateRequest
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
	}

	unload(): void {
		this.context.emitter.off(
			"editor-content-changed",
			this.handleEditorContentChanged
		);
		this.context.emitter.off(
			"settings-update-requested",
			this.handleSettingsUpdateRequest
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
		if (view instanceof HotSandboxNoteView && view.masterId) {
			this.context.cache.delete(view.masterId);
		}
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

	private handleSettingsUpdateRequest = async (
		payload: AppEvents["settings-update-requested"]
	) => {
		// this.data.settings = payload.settings;
		this.context.settings.updateSettingsAndSave(payload.settings);
		// await this.plugin.saveData(this.data);
		logger.debug("Settings saved to Obsidian storage.");
	};

	private handleConnectEditorPlugin = (
		payload: AppEvents["connect-editor-plugin"]
	) => {
		this.context.connectEditorPluginToView(payload.view);
	};

	private handleSettingsChanged = () => {
		this.context.applyLogger();
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
