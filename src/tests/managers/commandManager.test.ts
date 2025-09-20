import { beforeEach, describe, expect, it, vi } from "vitest";
import { around } from "monkey-around";
import type { App, Command } from "obsidian";
import type SandboxNotePlugin from "src/main";
import { CommandManager } from "src/managers/commandManager";
import type { SandboxNoteView } from "src/SandboxNoteView";

// Let vitest handle the mocking. It will replace 'around' with a spy.
vi.mock("monkey-around");

describe("CommandManager", () => {
	let mockPlugin: SandboxNotePlugin;
	let mockApp: App;
	let mockSaveManager: { saveNoteContentToFile: ReturnType<typeof vi.fn> };
	let mockOriginalSaveCommand: Command;
	let commandManager: CommandManager;
	const mockUnpatch = vi.fn();
	let originalCheckCallbackSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();

		originalCheckCallbackSpy = vi.fn((checking: boolean) => !checking);

		(around as ReturnType<typeof vi.fn>).mockImplementation(
			(obj, methods) => {
				const patchedCheckCallback = methods.checkCallback(
					obj.checkCallback
				);
				obj.checkCallback = patchedCheckCallback;
				return mockUnpatch;
			}
		);

		mockOriginalSaveCommand = {
			id: "editor:save-file",
			name: "Save current file",
			checkCallback: originalCheckCallbackSpy,
		};

		mockApp = {
			commands: {
				commands: {
					"editor:save-file": mockOriginalSaveCommand,
				},
			} as any,
			workspace: {
				getActiveViewOfType: vi.fn(),
			},
		} as unknown as App;

		mockSaveManager = {
			saveNoteContentToFile: vi.fn(),
		};

		mockPlugin = {
			app: mockApp,
			saveManager: mockSaveManager,
			settings: {
				enableSaveNoteContent: false,
				enableUnsafeCtrlS: false,
			},
			register: vi.fn(),
		} as unknown as SandboxNotePlugin;

		commandManager = new CommandManager(mockPlugin);
	});

	it("should not apply patch if setting is disabled on load", () => {
		commandManager.updateSaveCommandMonkeyPatch();
		expect(around).not.toHaveBeenCalled();
	});

	it("should apply patch if setting is enabled on load", () => {
		mockPlugin.settings.enableUnsafeCtrlS = true;
		commandManager.updateSaveCommandMonkeyPatch();
		expect(around).toHaveBeenCalledOnce();
		expect(mockPlugin.register).toHaveBeenCalledWith(mockUnpatch);
	});

	it("should not fail if the save command does not exist", () => {
		(
			mockPlugin.app.commands.commands as Record<
				string,
				Command | undefined
			>
		)["editor:save-file"] = undefined;
		mockPlugin.settings.enableUnsafeCtrlS = true;

		expect(() => {
			commandManager.updateSaveCommandMonkeyPatch();
		}).not.toThrow();
		expect(around).not.toHaveBeenCalled();
	});

	it("should apply and remove patch dynamically when setting is toggled", () => {
		commandManager.updateSaveCommandMonkeyPatch();
		expect(around).not.toHaveBeenCalled();

		mockPlugin.settings.enableUnsafeCtrlS = true;
		commandManager.updateSaveCommandMonkeyPatch();
		expect(around).toHaveBeenCalledOnce();
		expect(mockPlugin.register).toHaveBeenCalledWith(mockUnpatch);

		mockPlugin.settings.enableUnsafeCtrlS = false;
		commandManager.updateSaveCommandMonkeyPatch();
		expect(mockUnpatch).toHaveBeenCalledOnce();
	});

	describe("Patched Save Command Logic", () => {
		beforeEach(() => {
			mockPlugin.settings.enableUnsafeCtrlS = true;
			commandManager.updateSaveCommandMonkeyPatch();
		});

		it("should call custom save logic for SandboxNoteView", () => {
			(
				mockApp.workspace.getActiveViewOfType as ReturnType<
					typeof vi.fn
				>
			).mockReturnValue({} as SandboxNoteView);

			const checking = false;
			let result;
			if (mockOriginalSaveCommand.checkCallback) {
				result = mockOriginalSaveCommand.checkCallback(checking);
			}

			expect(
				mockSaveManager.saveNoteContentToFile
			).toHaveBeenCalledOnce();
			expect(result).toBe(true);
			expect(originalCheckCallbackSpy).not.toHaveBeenCalled();
		});

		it("should call original save logic if view is not SandboxNoteView", () => {
			(
				mockApp.workspace.getActiveViewOfType as ReturnType<
					typeof vi.fn
				>
			).mockReturnValue(null);

			const checking = false;
			if (mockOriginalSaveCommand.checkCallback) {
				mockOriginalSaveCommand.checkCallback(checking);
			}

			expect(
				mockSaveManager.saveNoteContentToFile
			).not.toHaveBeenCalled();
			expect(originalCheckCallbackSpy).toHaveBeenCalledWith(checking);
		});
	});
});
