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
import { App, MarkdownView, Notice } from "obsidian";

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
		},
		Notice: vi.fn(),
		MarkdownView: vi.fn(),
	};
});

describe("SandboxNotePlugin", () => {
	let plugin: SandboxNotePlugin;
	let mockApp: App;

	beforeEach(() => {
		vi.clearAllMocks();

		// A more realistic mock of the App object
		mockApp = {
			workspace: {
				on: vi.fn(),
				onLayoutReady: vi.fn(),
			},
		} as unknown as App;

		// Create a new plugin instance for each test
		plugin = new SandboxNotePlugin(mockApp, {} as any);

		// Spy on methods that would be called during initialization instead of replacing them
		vi.spyOn(plugin, "loadSettings").mockResolvedValue(undefined);
		vi.spyOn(plugin, "initializeLogger").mockImplementation(() => {});
		vi.spyOn(plugin as any, "initializeManagers").mockImplementation(
			() => {}
		);
		vi.spyOn(plugin as any, "setupSettingsTab").mockImplementation(
			() => {}
		);
		vi.spyOn(
			plugin as any,
			"setupWorkspaceEventHandlers"
		).mockImplementation(() => {});
		vi.spyOn(plugin as any, "registerViewType").mockImplementation(
			() => {}
		);
		// We need to have the managers on the plugin instance for the spies to work
		plugin.contentManager = { sharedNoteContent: "" } as any;
		plugin.editorManager = { setupEditorExtension: vi.fn() } as any;
		plugin.uiManager = { setupUserInterface: vi.fn() } as any;
		plugin.commandManager = {
			updateSaveCommandMonkeyPatch: vi.fn(),
		} as any;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should disable the plugin and show a notice if compatibility check fails", async () => {
		// Arrange: Make the MarkdownView constructor throw an error
		const error = new Error("Incompatible version");
		(MarkdownView as Mock).mockImplementation(() => {
			throw error;
		});

		// Act: Call the onload method
		await plugin.onload();

		// Assert: Check that a notice was shown and initialization was halted
		expect(Notice).toHaveBeenCalledOnce();
		expect(Notice).toHaveBeenCalledWith(
			"Sandbox Note plugin: Incompatible with this version of Obsidian. The plugin has been disabled."
		);

		// Assert that further initialization methods were NOT called
		expect(plugin.loadSettings).not.toHaveBeenCalled();
		expect((plugin as any).initializeManagers).not.toHaveBeenCalled();
		expect((plugin as any).setupSettingsTab).not.toHaveBeenCalled();
	});

	it("should proceed with initialization if compatibility check passes", async () => {
		// Arrange: Make the MarkdownView constructor succeed
		(MarkdownView as Mock).mockImplementation(() => ({
			unload: vi.fn(), // Mock the unload method on the instance
		}));

		// Act: Call the onload method
		await plugin.onload();

		// Assert: Check that no notice was shown and initialization proceeded
		expect(Notice).not.toHaveBeenCalled();

		// Assert that initialization methods were called
		expect(plugin.loadSettings).toHaveBeenCalledOnce();
		expect((plugin as any).initializeManagers).toHaveBeenCalledOnce();
		expect((plugin as any).setupSettingsTab).toHaveBeenCalledOnce();
		expect(
			plugin.editorManager.setupEditorExtension
		).toHaveBeenCalledOnce();
	});
});
