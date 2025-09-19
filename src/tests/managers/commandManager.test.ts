import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandManager } from "src/managers/commandManager";
import type SandboxNotePlugin from "src/main";
import { App, type Command } from "obsidian";
import { SandboxNoteView } from "src/view";
import { around } from "monkey-around";

// Let vitest handle the mocking. It will replace 'around' with a spy.
vi.mock("monkey-around");

describe("CommandManager", () => {
	let mockPlugin: SandboxNotePlugin;
	let mockApp: App;
	let mockSaveManager: { saveNoteContentToFile: ReturnType<typeof vi.fn> };
	let mockOriginalSaveCommand: Command;
	let commandManager: CommandManager;

	beforeEach(() => {
		vi.clearAllMocks();

		// Provide the mock implementation for 'around' for each test.
		// This avoids the hoisting issue.
		(around as ReturnType<typeof vi.fn>).mockImplementation(
			(obj, methods) => {
				// We call the patch function immediately to get the wrapped function
				const patchedCheckCallback = methods.checkCallback(
					obj.checkCallback
				);
				// In the test, we replace the original callback with the patched one
				// to simulate the monkey patch.
				obj.checkCallback = patchedCheckCallback;
			}
		);

		// 1. Mock the original save command
		mockOriginalSaveCommand = {
			id: "editor:save-file",
			name: "Save current file",
			checkCallback: vi.fn(
				(checking: boolean) => !checking
			) as any,
		};

		// 2. Mock the application and its command registry
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

		// 3. Mock the plugin dependencies
		mockSaveManager = {
			saveNoteContentToFile: vi.fn(),
		};

		mockPlugin = {
			app: mockApp,
			saveManager: mockSaveManager,
			settings: {
				enableSaveNoteContent: true,
			},
			register: vi.fn(),
		} as unknown as SandboxNotePlugin;

		commandManager = new CommandManager(mockPlugin);
	});

	it("should find the save command and register a patch", () => {
		commandManager.setupSaveCommandMonkeyPatch();

		expect(around).toHaveBeenCalledOnce();
		expect(around).toHaveBeenCalledWith(
			mockOriginalSaveCommand,
			expect.any(Object)
		);
		expect(mockPlugin.register).toHaveBeenCalledOnce();
	});

	it("should not fail if the save command does not exist", () => {
		(
			mockPlugin.app.commands.commands as Record<string, Command | undefined>
		)["editor:save-file"] = undefined;

		expect(() => {
			commandManager.setupSaveCommandMonkeyPatch();
		}).not.toThrow();
		expect(around).not.toHaveBeenCalled();
	});

	describe("Patched Save Command Logic", () => {
		let originalCheckCallbackSpy:
			| ((checking: boolean) => boolean | void)
			| undefined;

		beforeEach(() => {
			// Keep a clear spy on the original function before it gets patched
			originalCheckCallbackSpy = mockOriginalSaveCommand.checkCallback;
			commandManager.setupSaveCommandMonkeyPatch();
		});

		it("should call original checkCallback when just checking", () => {
			const checking = true;
			if (mockOriginalSaveCommand.checkCallback) {
				mockOriginalSaveCommand.checkCallback(checking);
			}

			expect(originalCheckCallbackSpy).toHaveBeenCalledWith(checking);
			expect(
				mockSaveManager.saveNoteContentToFile
			).not.toHaveBeenCalled();
		});

		it("should call custom save logic for SandboxNoteView when enabled", () => {
			const mockView = {} as SandboxNoteView;
			(
				mockApp.workspace.getActiveViewOfType as ReturnType<
					typeof vi.fn
				>
			).mockReturnValue(mockView);
			mockPlugin.settings.enableSaveNoteContent = true;

			const checking = false;
			let result;
			if (mockOriginalSaveCommand.checkCallback) {
				result = mockOriginalSaveCommand.checkCallback(checking);
			}

			expect(
				mockSaveManager.saveNoteContentToFile
			).toHaveBeenCalledOnce();
			expect(mockSaveManager.saveNoteContentToFile).toHaveBeenCalledWith(
				mockView
			);
			expect(originalCheckCallbackSpy).not.toHaveBeenCalled();
			expect(result).toBe(true);
		});

		it("should call original save logic if setting is disabled", () => {
			const mockView = {} as SandboxNoteView;
			(
				mockApp.workspace.getActiveViewOfType as ReturnType<
					typeof vi.fn
				>
			).mockReturnValue(mockView);
			mockPlugin.settings.enableSaveNoteContent = false;

			const checking = false;
			if (mockOriginalSaveCommand.checkCallback) {
				mockOriginalSaveCommand.checkCallback(checking);
			}

			expect(
				mockSaveManager.saveNoteContentToFile
			).not.toHaveBeenCalled();
			expect(originalCheckCallbackSpy).toHaveBeenCalledWith(checking);
		});

		it("should call original save logic if active view is not SandboxNoteView", () => {
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

		it("should call original save logic if custom save logic throws an error", () => {
			const mockView = {} as SandboxNoteView;
			(
				mockApp.workspace.getActiveViewOfType as ReturnType<
					typeof vi.fn
				>
			).mockReturnValue(mockView);
			mockPlugin.settings.enableSaveNoteContent = true;
			const testError = new Error("Test error");
			mockSaveManager.saveNoteContentToFile.mockImplementation(() => {
				throw testError;
			});
			const consoleErrorSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});

			const checking = false;
			if (mockOriginalSaveCommand.checkCallback) {
				mockOriginalSaveCommand.checkCallback(checking);
			}

			expect(
				mockSaveManager.saveNoteContentToFile
			).toHaveBeenCalledOnce();
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"SandBox-note: monkey patch for save command failed.",
				testError
			);
			expect(originalCheckCallbackSpy).toHaveBeenCalledWith(checking);

			consoleErrorSpy.mockRestore();
		});
	});
});
