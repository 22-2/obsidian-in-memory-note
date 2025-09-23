import { SandboxNoteView } from "../views/SandboxNoteView";
import { debounce, type DebouncedFunction } from "../utils";
import type SandboxNotePlugin from "../main";
import log from "loglevel";

const SAVE_DEBOUNCE_DELAY = 1000;

/** Manages content persistence and auto-save functionality */
export class AutoSaveHandler {
	private plugin: SandboxNotePlugin;
	private previousActiveView: SandboxNoteView | null = null;
	private isSaving = false;

	/** Debounced save function */
	debouncedSave: DebouncedFunction<(view: SandboxNoteView) => Promise<void>>;

	constructor(plugin: SandboxNotePlugin) {
		this.plugin = plugin;
		this.debouncedSave = debounce(
			(view: SandboxNoteView) => this.saveNoteContentToFile(view),
			SAVE_DEBOUNCE_DELAY
		);
	}

	/** Handle active leaf changes and auto-save if enabled */
	handleActiveLeafChange() {
		const activeView =
			this.plugin.app.workspace.getActiveViewOfType(SandboxNoteView);

		log.debug(
			`Handling active leaf change. Previous: ${
				this.previousActiveView?.getViewType() ?? "none"
			}, Current: ${activeView?.getViewType() ?? "none"}`
		);

		// Auto-save content from previous view when save setting is enabled
		if (
			this.plugin.settings.enableSaveNoteContent &&
			this.previousActiveView
		) {
			log.debug(
				`Triggering save for previous view: ${this.previousActiveView.getViewType()}`
			);
			this.saveNoteContentToFile(this.previousActiveView);
		}

		this.previousActiveView = activeView;
	}

	/**
	 * Save note content to data.json after performing necessary checks.
	 * This method orchestrates the save operation.
	 */
	async saveNoteContentToFile(view: SandboxNoteView) {
		// 保留中のデバウンスされた保存があればキャンセルする
		this.debouncedSave.cancel();

		// 保存処理を実行できるかチェック
		if (!this.canSave(view)) {
			return;
		}

		// canSaveでチェック済みのため、型アサーションを使用
		const content = view.wrapper.getContent() as string;

		log.debug(`Save triggered for view: ${view.getViewType()}`);
		try {
			this.isSaving = true;
			// 実際の保存処理を実行
			await this.persistContent(content, view);
		} catch (error) {
			log.error(`Failed to auto-save note content: ${error}`);
		} finally {
			this.isSaving = false;
		}
	}

	/**
	 * Checks if the content of the view can be saved.
	 * @param view The view to check.
	 * @returns True if saving is possible, false otherwise.
	 */
	private canSave(view: SandboxNoteView): boolean {
		// 保存処理がすでに進行中の場合はスキップ
		if (this.isSaving) {
			log.debug("Skipping save: A save is already in progress.");
			return false;
		}

		// コンテンツが不正な場合はスキップ
		const content = view.wrapper.getContent();
		if (typeof content !== "string") {
			log.debug("Skipping save: Sandbox note content is invalid.");
			return false;
		}

		return true;
	}

	/**
	 * Persists the given content to the plugin's data file and updates the view state.
	 * @param content The content to save.
	 * @param view The view to mark as saved.
	 */
	private async persistContent(
		content: string,
		view: SandboxNoteView
	): Promise<void> {
		// インメモリのsettingsを更新して同期を保つ
		this.plugin.settings.noteContent = content;
		this.plugin.settings.lastSaved = new Date().toISOString();

		// Obsidian APIを使用してcontentをdata.jsonに保存
		await this.plugin.saveData(this.plugin.settings);

		// コンテンツが永続化されたので、viewを保存済みとしてマーク
		view.markAsSaved();

		log.debug("Auto-saved note content to data.json using Obsidian API");
	}
}
