import type { AppEvents } from "src/events/AppEvents";
import type { DatabaseController } from "src/managers/DatabaseController";
import type { Manager } from "src/managers/Manager";
import type { EventEmitter } from "src/utils/EventEmitter";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";
import type { CacheManager } from "./CacheManager";
import type { SettingsManager } from "./SettingsManager";

export class AppEventManager implements Manager {
	constructor(
		private emitter: EventEmitter<AppEvents>,
		private cache: CacheManager,
		private settingsManager: SettingsManager,
		private dbController: DatabaseController
	) {}

	load(): void {
		this.emitter.on(
			"editor-content-changed",
			this.handleEditorContentChanged
		);
	}

	unload(): void {
		this.emitter.off(
			"editor-content-changed",
			this.handleEditorContentChanged
		);
	}

	private handleEditorContentChanged = (
		payload: AppEvents["editor-content-changed"]
	) => {
		const { content, sourceView } = payload;

		if (
			sourceView instanceof HotSandboxNoteView &&
			sourceView.masterNoteId
		) {
			// インメモリ状態を更新
			this.cache.updateNoteContent(sourceView.masterNoteId, content);

			// 自動保存が有効な場合はデバウンス保存
			if (this.settingsManager.getSettings().enableAutoSave) {
				const debounceMs =
					this.settingsManager.getSettings().autoSaveDebounceMs;
				this.dbController.debouncedSave(
					sourceView.masterNoteId,
					content,
					debounceMs
				);
			}
		}
	};
}
