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

const logger = log.getLogger("AppOrchestrator");

type Context = {
	saveSandbox: DatabaseManager["debouncedSaveSandbox"];
	applyLogger: SandboxPlugin["applyLogger"];
	cache: CacheManager;
	emitter: EventEmitter<AppEvents>;
	settings: SettingsManager;
	connectEditorPluginToView: CodeMirrorExtensionManager["connectEditorPluginToView"];
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

		if (
			sourceView instanceof HotSandboxNoteView &&
			sourceView.masterNoteId
		) {
			// インメモリ状態を更新
			this.context.cache.updateNoteContent(
				sourceView.masterNoteId,
				content
			);

			// 自動保存が有効な場合はデバウンス保存
			if (this.context.settings.getSettings().enableAutoSave) {
				const debounceMs =
					this.context.settings.getSettings().autoSaveDebounceMs;
				this.context.saveSandbox(
					sourceView.masterNoteId,
					content,
					debounceMs
				);
			}
		}
	};
}
