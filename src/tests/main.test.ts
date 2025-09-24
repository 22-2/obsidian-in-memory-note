import {
	describe,
	it,
	expect,
	vi,
	beforeEach,
	afterEach,
	type Mock,
} from "vitest";
import SandboxNotePlugin from "../main";
import { App, Notice } from "obsidian";
import { UnsafeMarkdownView } from "../views/internal/UnsafeMarkdownView";

vi.mock("../views/internal/UnsafeMarkdownView", () => {
	const UnsafeMarkdownView = vi.fn();
	UnsafeMarkdownView.prototype.unload = vi.fn();
	return { UnsafeMarkdownView };
});

// Mock only the necessary parts of the 'obsidian' module
vi.mock("obsidian", async (importOriginal) => {
	const actual = await importOriginal<typeof import("obsidian")>();
	return {
		...actual,
		// Keep the actual Plugin base class, but mock its constructor behavior if needed
		Plugin: class {
			app: App;
			constructor(app: App) {
				this.app = app;
			}
			loadData = vi.fn().mockResolvedValue({});
			saveData = vi.fn().mockResolvedValue(undefined);
			registerEditorExtension = vi.fn();
			addSettingTab = vi.fn();
			registerView = vi.fn();
			registerDomEvent = vi.fn();
			addCommand = vi.fn();
			addRibbonIcon = vi.fn();
			registerEvent = vi.fn();
		},
		Notice: vi.fn(),
	};
});

describe("SandboxNotePlugin", () => {
	let plugin: SandboxNotePlugin;
	let mockApp: App;

	beforeEach(() => {
		vi.clearAllMocks();

		mockApp = {
			workspace: {
				on: vi.fn(),
				onLayoutReady: vi.fn(),
			},
		} as unknown as App;

		plugin = new SandboxNotePlugin(mockApp, {} as any);

		vi.spyOn(plugin, "loadSettings").mockResolvedValue(undefined);
		vi.spyOn(plugin, "initializeLogger").mockImplementation(() => {});
		// We are not spying on initializeManagers, but we need to mock the managers
		// because the real initializeManagers is not called in this test setup.
		// Instead, we will check that the methods on the managers are called.
		plugin.editorSyncManager = {
			load: vi.fn(),
		} as any;
		plugin.saveManager = {
			load: vi.fn(),
		} as any;
		plugin.interactionManager = { load: vi.fn() } as any;
		plugin.editorPluginConnector = { load: vi.fn() } as any;
		plugin.viewFactory = { load: vi.fn() } as any;
		plugin.workspaceEventManager = { load: vi.fn() } as any;
		plugin.eventManager = { load: vi.fn() } as any;
		plugin.managers = [
			plugin.editorSyncManager,
			plugin.saveManager,
			plugin.interactionManager,
			plugin.editorPluginConnector,
			plugin.viewFactory,
			plugin.workspaceEventManager,
			plugin.eventManager,
		];

		vi.spyOn(plugin as any, "setupSettingsTab").mockImplementation(
			() => {}
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should proceed with initialization if compatibility check passes", async () => {
		(UnsafeMarkdownView as Mock).mockImplementation(() => ({
			unload: vi.fn(),
		}));

		const initializeManagersSpy = vi
			.spyOn(plugin as any, "initializeManagers")
			.mockImplementation(() => {
				plugin.editorSyncManager = {
					load: vi.fn(),
				} as any;
				plugin.saveManager = {
					load: vi.fn(),
				} as any;
				plugin.interactionManager = {
					load: vi.fn(),
				} as any;
				plugin.editorPluginConnector = {
					load: vi.fn(),
				} as any;
				plugin.viewFactory = { load: vi.fn() } as any;
				plugin.workspaceEventManager = {
					load: vi.fn(),
				} as any;
				plugin.eventManager = {
					load: vi.fn(),
				} as any;
				plugin.managers = [
					plugin.editorSyncManager,
					plugin.saveManager,
					plugin.interactionManager,
					plugin.editorPluginConnector,
					plugin.viewFactory,
					plugin.workspaceEventManager,
					plugin.eventManager,
				];
			});

		await plugin.onload();

		expect(Notice).not.toHaveBeenCalled();
		expect(plugin.loadSettings).toHaveBeenCalledOnce();
		expect(initializeManagersSpy).toHaveBeenCalledOnce();
		expect((plugin as any).setupSettingsTab).toHaveBeenCalledOnce();
		for (const manager of plugin.managers) {
			expect(manager.load).toHaveBeenCalledOnce();
		}
	});
});
