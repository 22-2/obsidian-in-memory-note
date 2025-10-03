// File: src/managers/ViewPatchManager.ts (New File)
import log from "loglevel";
import { around } from "monkey-around";
import { Platform, WorkspaceLeaf, type Plugin } from "obsidian";
import type { Commands } from "obsidian-typings";
import type { AppEvents } from "src/events/AppEvents";
import type { EventEmitter } from "src/utils/EventEmitter";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";
import { getSandboxVaultPath } from "src/views/internal/utils";
import type { AppOrchestrator } from "./AppOrchestrator";
import type { IManager } from "./IManager";

const logger = log.getLogger("ViewPatchManager");

type Context = {
	register: Plugin["register"];
	getActiveView: AppOrchestrator["getActiveView"];
	findCommand: Commands["findCommand"];
	getSettings: AppOrchestrator["getSettings"];
	emitter: EventEmitter<AppEvents>;
};

/**
 * Manages monkey-patches for core Obsidian view functionality,
 * specifically for HotSandboxNoteView lifecycle methods (close, save).
 */
export class ViewPatchManager implements IManager {
	private patchCleanupFns: (() => void)[] = [];

	constructor(private context: Context) {}

	load(): void {
		logger.debug("Applying WorkspaceLeaf patches...");
		// Apply the patch immediately.
		this.applyLeafDetachPatch();

		// Apply the save patch after layout-ready (once the command is available).
		this.context.emitter.on("obsidian-layout-ready", () => {
			logger.debug("obsidian-layout-ready received, applying save patch");
			this.applyLeafSavePatch();
			logger.debug("Save patch applied successfully");
		});
	}

	unload(): void {
		logger.debug("Cleaning up WorkspaceLeaf patches...");
		this.patchCleanupFns.forEach((fn) => fn());
		this.patchCleanupFns = [];
	}

	/**
	 * Patches WorkspaceLeaf.prototype.detach to intercept the closing event
	 * and execute HotSandboxNoteView's shouldClose logic (confirmation dialog).
	 */
	private applyLeafDetachPatch(): void {
		logger.debug("Applying detach patch to WorkspaceLeaf.prototype");
		const cleanup = around(WorkspaceLeaf.prototype, {
			detach: (orig) =>
				async function (this: WorkspaceLeaf) {
					logger.debug(
						"detach called, view type:",
						this.view?.getViewType()
					);
					if (!(this.view instanceof HotSandboxNoteView)) {
						logger.debug("default close");
						return orig.call(this);
					}

					const shouldInitialClose =
						Platform.isDesktopApp &&
						getSandboxVaultPath() ===
							this.app.vault.adapter.basePath &&
						this.app.vault.getName() === "Obsidian Sandbox";

					logger.debug("shouldInitialClose", shouldInitialClose);

					// Handling automatic closing of the Sandbox Vault
					if (shouldInitialClose) {
						return orig.call(this);
					}

					// HotSandboxNoteViewの場合、閉じる前に確認を行う
					let shouldClose = false;
					try {
						logger.debug("shouldClose check");
						shouldClose = await (
							this.view as HotSandboxNoteView
						).shouldClose();
						logger.debug("check done");
					} catch (error) {
						logger.error("Error during shouldClose check:", error);
						shouldClose = true; // エラー時は閉じるのを許可（安全のため）
					}

					if (shouldClose) {
						logger.debug("close called");
						return orig.call(this);
					}

					logger.debug("close not called");
					// 閉じない場合はorig.call()を実行しないことで処理を中断
				},
		});
		this.patchCleanupFns.push(cleanup);
		this.context.register(cleanup);
	}

	/**
	 * Patches WorkspaceLeaf.prototype.save to intercept Ctrl+S events
	 * and execute HotSandboxNoteView's save logic (conversion to file).
	 */
	private applyLeafSavePatch(): void {
		const saveCommandDefinition =
			this.context.findCommand("editor:save-file");
		if (!saveCommandDefinition?.checkCallback) {
			logger.debug("saveCommandDefinition.checkCallback not found");
			return;
		}

		const cleanup = around(saveCommandDefinition, {
			checkCallback: (orig) => (checking: boolean) => {
				const settings = this.context.getSettings();
				if (!settings["fileOperation.saveToVaultOnCommandExecuted"])
					return orig?.call(this, checking) || false;
				const activeView = this.context.getActiveView();
				if (!activeView) {
					return orig?.call(this, checking) || false;
				}
				if (!checking) {
					activeView.handleSaveRequest({
						allowEmpty: true,
					});
					return true; // Indicate that the command was handled.
				}
				return false;
			},
		});
		this.patchCleanupFns.push(cleanup);
		this.context.register(cleanup);
		logger.debug("Applied WorkspaceLeaf.prototype.save patch");
	}
}
