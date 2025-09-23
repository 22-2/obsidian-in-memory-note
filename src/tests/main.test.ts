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
import { UnsafeMarkdownView } from "../views/helpers/UnsafeMarkdownView";

vi.mock("../views/helpers/UnsafeMarkdownView", () => {
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
			sharedNoteContent: "",
			refreshAllViewTitles: vi.fn(),
		} as any;
		plugin.saveManager = {} as any;
		plugin.uiManager = { setupUserInterface: vi.fn() } as any;
		plugin.editorPluginConnector = { setupEditorExtension: vi.fn() } as any;
		plugin.viewActivator = { registerViews: vi.fn() } as any;
		plugin.workspaceEventManager = { setupEventHandlers: vi.fn() } as any;
		plugin.eventManager = { registerEventHandlers: vi.fn() } as any;

		vi.spyOn(plugin as any, "setupSettingsTab").mockImplementation(
			() => {}
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should disable the plugin and show a notice if compatibility check fails", async () => {
		const error = new Error("Incompatible version");
		(UnsafeMarkdownView as Mock).mockImplementation(() => {
			throw error;
		});

		await plugin.onload();

		expect(Notice).toHaveBeenCalledOnce();
		expect(Notice).toHaveBeenCalledWith(
			"Sandbox Note plugin: Incompatible with this version of Obsidian. The plugin has been disabled."
		);

		expect(plugin.loadSettings).not.toHaveBeenCalled();
		expect(plugin.uiManager.setupUserInterface).not.toHaveBeenCalled();
	});

	it("should proceed with initialization if compatibility check passes", async () => {
		(UnsafeMarkdownView as Mock).mockImplementation(() => ({
			unload: vi.fn(),
		}));

		const initializeManagersSpy = vi
			.spyOn(plugin as any, "initializeManagers")
			.mockImplementation(() => {
				plugin.editorSyncManager = {
					sharedNoteContent: "",
					refreshAllViewTitles: vi.fn(),
				} as any;
				plugin.saveManager = {} as any;
				plugin.uiManager = { setupUserInterface: vi.fn() } as any;
				plugin.editorPluginConnector = {
					setupEditorExtension: vi.fn(),
				} as any;
				plugin.viewActivator = { registerViews: vi.fn() } as any;
				plugin.workspaceEventManager = {
					setupEventHandlers: vi.fn(),
				} as any;
				plugin.eventManager = {
					registerEventHandlers: vi.fn(),
				} as any;
			});

		await plugin.onload();

		expect(Notice).not.toHaveBeenCalled();
		expect(plugin.loadSettings).toHaveBeenCalledOnce();
		expect(initializeManagersSpy).toHaveBeenCalledOnce();
		expect((plugin as any).setupSettingsTab).toHaveBeenCalledOnce();
		expect(plugin.eventManager.registerEventHandlers).toHaveBeenCalledOnce();
		expect(
			plugin.editorPluginConnector.setupEditorExtension
		).toHaveBeenCalledOnce();
		expect(plugin.uiManager.setupUserInterface).toHaveBeenCalledOnce();
		expect(plugin.viewActivator.registerViews).toHaveBeenCalledOnce();
		expect(
			plugin.workspaceEventManager.setupEventHandlers
		).toHaveBeenCalledOnce();
	});
});
