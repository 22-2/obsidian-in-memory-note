import log from "loglevel";
import type { WorkspaceLeaf } from "obsidian";
import type { AppEvents } from "src/events/AppEvents";
import type SandboxNotePlugin from "src/main";
import { DatabaseManager } from "src/managers/DatabaseManager";
import type { EventEmitter } from "src/utils/EventEmitter";
import { HotSandboxNoteView } from "src/views/HotSandboxNoteView";
import invariant from "tiny-invariant";
import { CacheManager } from "./CacheManager";
import { CodeMirrorExtensionManager } from "./CodeMirrorExtensionManager";
import { DatabaseAPI } from "./DatabaseAPI";
import { EditorSyncManager } from "./EditorSyncManager";
import type { IManager } from "./IManager";
import { ObsidianEventManager } from "./ObsidianEventManager";
import { PluginEventManager } from "./PluginEventManager";
import { SettingsManager } from "./SettingsManager";
import { URIManager } from "./URIManager";
import { ViewManager } from "./ViewManager";

const logger = log.getLogger("AppOrchestrator");

// 型名を短くするためのエイリアス
type ManagerName =
	| "settingsManager"
	| "cacheManager"
	| "pluginEventManager"
	| "editorSyncManager"
	| "cmExtensionManager"
	| "viewManager"
	| "obsidianEventManager"
	| "uriManager"
	| "dbManager";

const managerNames: ManagerName[] = [
	// ロード順序が重要な場合はここにその順序で並べる
	"settingsManager",
	"cacheManager",
	"dbManager",
	"viewManager",
	"editorSyncManager",
	"cmExtensionManager",
	"pluginEventManager",
	"obsidianEventManager",
	"uriManager",
];

/**
 * DIコンテナとして機能し、マネージャーのライフサイクルと依存関係を管理します。
 */
export class AppOrchestrator implements IManager {
	protected plugin: SandboxNotePlugin;
	protected emitter: EventEmitter<AppEvents>;

	// 生成したインスタンスをキャッシュするMap
	private instances = new Map<ManagerName, IManager>();
	// 各マネージャーを生成するためのファクトリメソッドを登録するMap
	private factories = new Map<ManagerName, () => IManager>();
	private dbAPI: DatabaseAPI;

	constructor(plugin: SandboxNotePlugin, emitter: EventEmitter<AppEvents>) {
		this.plugin = plugin;
		this.emitter = emitter;
		this.dbAPI = new DatabaseAPI();

		// ここで各マネージャーの「作り方」を登録する。インスタンス化はしない！
		this.registerFactories();
	}

	/**
	 * 指定された名前のマネージャーインスタンスを取得します。
	 * インスタンスがなければファクトリを使って生成し、キャッシュします。
	 */
	public get<T extends IManager>(name: ManagerName): T {
		if (!this.instances.has(name)) {
			const factory = this.factories.get(name);
			if (!factory) {
				throw new Error(`No factory registered for ${name}`);
			}
			this.instances.set(name, factory());
		}
		return this.instances.get(name) as T;
	}

	private registerFactories(): void {
		this.factories.set(
			"settingsManager",
			() =>
				new SettingsManager({
					emitter: this.emitter,
					loadData: this.plugin.loadData.bind(this.plugin),
					saveData: this.plugin.saveData.bind(this.plugin),
				})
		);

		this.factories.set(
			"cacheManager",
			() =>
				new CacheManager({
					emitter: this.emitter,
					getDbManager: () => this.get<DatabaseManager>("dbManager"),
				})
		);

		this.factories.set("dbManager", () => {
			const cacheManager = this.get<CacheManager>("cacheManager");
			return new DatabaseManager({
				dbAPI: this.dbAPI,
				cache: {
					get: (noteId: string) => cacheManager.get(noteId),
					set: (noteId: string, content: string) =>
						cacheManager.updateNoteContent(noteId, content),
					delete: (noteId: string) => cacheManager.delete(noteId),
				},
				emitter: this.emitter,
				getAllHotSandboxViews: () =>
					this.get<ViewManager>("viewManager").getAllViews(),
			});
		});

		this.factories.set("viewManager", () => {
			const settingsManager =
				this.get<SettingsManager>("settingsManager");
			const cacheManager = this.get<CacheManager>("cacheManager");
			const viewManager = new ViewManager({
				registerView: (type, viewCreator) =>
					this.plugin.registerView(type, viewCreator),
				createView: (leaf: WorkspaceLeaf): HotSandboxNoteView =>
					new HotSandboxNoteView(leaf, {
						emitter: this.emitter,
						getSettings: () => settingsManager.getSettings(),
						getDisplayIndex: (masterId: string) => {
							invariant(masterId, "masterId should not be null");

							const groupCount =
								viewManager.indexOfMasterId(masterId);
							logger.debug("groupCount", groupCount);
							if (groupCount === -1) {
								return 0;
							}
							return groupCount + 1;
						},
						isLastHotView: (id: string) =>
							viewManager.isLastHotView(id),
						deleteFromAll: (id: string) =>
							this.get<DatabaseManager>(
								"dbManager"
							).deleteFromAll(id),
					}),
				getLeaf: (type) => this.plugin.app.workspace.getLeaf(type),
				detachLeavesOfType: (type) =>
					this.plugin.app.workspace.detachLeavesOfType(type),
				getActiveViewOfType: (type) =>
					this.plugin.app.workspace.getActiveViewOfType(type),
				getLeavesOfType: (type: string) =>
					this.plugin.app.workspace.getLeavesOfType(type),
				getAllNotes: () => cacheManager.getAllSandboxes(),
			});
			return viewManager;
		});

		this.factories.set("editorSyncManager", () => {
			const viewManager = this.get<ViewManager>("viewManager");
			const cacheManager = this.get<CacheManager>("cacheManager");
			return new EditorSyncManager({
				emitter: this.emitter,
				getAllHotSandboxViews: () => viewManager.getAllViews(),
				getAllNotes: () => cacheManager.getAllSandboxes(),
				registerNewNote: (note) => cacheManager.registerNewNote(note),
				getNoteContent: (noteId) => cacheManager.getNoteContent(noteId),
				getActiveView: () => viewManager.getActiveView(),
				workspace: this.plugin.app.workspace as never,
			});
		});

		this.factories.set(
			"cmExtensionManager",
			() =>
				new CodeMirrorExtensionManager({
					emitter: this.emitter,
					plugin: this.plugin,
				})
		);

		this.factories.set("pluginEventManager", () => {
			const dbManager = this.get<DatabaseManager>("dbManager");
			const viewManager = this.get<ViewManager>("viewManager"); // 変更点：viewManagerを取得
			return new PluginEventManager({
				applyLogger: this.plugin.applyLogger.bind(this.plugin),
				cache: this.get<CacheManager>("cacheManager"),
				emitter: this.emitter,
				settings: this.get<SettingsManager>("settingsManager"),
				connectEditorPluginToView: (leaf) => {
					this.get<CodeMirrorExtensionManager>(
						"cmExtensionManager"
					).connectEditorPluginToView(leaf);
				},
				saveSandbox: (...args) =>
					dbManager.debouncedSaveSandboxes(...args),
				clearAllDeadSandboxes: () => dbManager.clearAllDeadSandboxes(),
				getAllViews: () => viewManager.getAllViews(),
				isLastHotView: (masterId: string) =>
					viewManager.isLastHotView(masterId),
				deleteFromAll: (masterId: string | null) =>
					dbManager.deleteFromAll(masterId),
			});
		});

		this.factories.set("obsidianEventManager", () => {
			const viewManager = this.get<ViewManager>("viewManager");
			return new ObsidianEventManager(
				{
					getActiveView: () => viewManager.getActiveView(),
					workspaceEvents: this.plugin.app.workspace,
				},
				this.emitter
			);
		});

		this.factories.set("uriManager", () => {
			return new URIManager({
				registerObsidianProtocolHandler:
					this.plugin.registerObsidianProtocolHandler.bind(
						this.plugin
					),
				createAndOpenSandbox: (content) =>
					this.get<ViewManager>("viewManager").createAndOpenSandbox(
						content
					),
			});
		});
	}

	async load(): Promise<void> {
		for (const name of managerNames) {
			const manager = this.get<IManager>(name);
			invariant(manager?.load, `No load method for ${name}`);
			await manager.load();
		}
		logger.debug(
			"AppOrchestrator and all sub-managers loaded successfully."
		);
	}

	unload(): void {
		for (const name of managerNames) {
			const manager = this.instances.get(name) as IManager | undefined;
			invariant(manager?.unload, `No unload method for ${name}`);
			manager.unload();
		}
		logger.debug(
			"AppOrchestrator and all sub-managers unloaded successfully."
		);
	}

	// --- Delegated Methods ---
	getActiveView() {
		return this.get<ViewManager>("viewManager").getActiveView();
	}
	getAllView() {
		return this.get<ViewManager>("viewManager").getAllViews();
	}
	activateView() {
		return this.get<ViewManager>("viewManager").activateView();
	}
	getSettings() {
		return this.get<SettingsManager>("settingsManager").getSettings();
	}
	async updateSettings(
		settings: Parameters<SettingsManager["updateSettingsAndSave"]>[0]
	) {
		await this.get<SettingsManager>(
			"settingsManager"
		).updateSettingsAndSave(settings);
	}
}
