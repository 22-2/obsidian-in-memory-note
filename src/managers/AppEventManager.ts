import type { EventEmitter } from "src/utils/EventEmitter";
import type { AppEvents } from "src/events/AppEvents";
import type { AbstractNoteView } from "src/views/internal/AbstractNoteView";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";
import type { HotSandboxManager } from "./HotSandboxManager";
import type { SettingsManager } from "./SettingsManager";

export class AppEventManager {
	private emitter: EventEmitter<AppEvents>;
	private hotSandboxManager: HotSandboxManager;
	private settingsManager: SettingsManager;

	constructor(
		emitter: EventEmitter<AppEvents>,
		hotNoteManager: HotSandboxManager,
		settingsManager: SettingsManager
	) {
		this.emitter = emitter;
		this.hotSandboxManager = hotNoteManager;
		this.settingsManager = settingsManager;
	}

	registerEventListeners(): void {
		this.emitter.on("save-requested", this.handleSaveRequest);
		this.emitter.on(
			"editor-content-changed",
			this.handleEditorContentChanged
		);
		this.emitter.on("delete-requested", this.handleDeleteRequest);
	}

	unregisterEventListeners(): void {
		this.emitter.off("save-requested", this.handleSaveRequest);
		this.emitter.off(
			"editor-content-changed",
			this.handleEditorContentChanged
		);
		this.emitter.off("delete-requested", this.handleDeleteRequest);
	}

	private sandboxGuard = (
		view: AbstractNoteView,
		callback: (view: HotSandboxNoteView & { masterNoteId: string }) => void
	) => {
		if (view instanceof HotSandboxNoteView && view.masterNoteId) {
			return callback(
				view! as HotSandboxNoteView & { masterNoteId: string }
			);
		}
	};

	private handleSaveRequest = (payload: AppEvents["save-requested"]) => {
		this.sandboxGuard(payload.view, (view) => {
			this.hotSandboxManager.saveToDatabase(
				view.masterNoteId,
				view.getContent()
			);
		});
	};

	private handleDeleteRequest = (payload: AppEvents["delete-requested"]) => {
		this.sandboxGuard(payload.view, (view) => {
			this.hotSandboxManager.deleteFromDatabase(view.masterNoteId);
		});
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
			this.hotSandboxManager.updateNoteContent(
				sourceView.masterNoteId,
				content
			);

			// 自動保存が有効な場合はデバウンス保存
			if (this.settingsManager.getSettings().enableAutoSave) {
				const debounceMs =
					this.settingsManager.getSettings().autoSaveDebounceMs;
				this.hotSandboxManager.debouncedSave(
					sourceView.masterNoteId,
					content,
					debounceMs
				);
			}
		}
	};
}
