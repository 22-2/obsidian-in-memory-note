import type SandboxNotePlugin from "src/main";
import { UIManager } from "src/managers/UIManager";
import { IN_MEMORY_NOTE_ICON, SANDBOX_NOTE_ICON } from "src/utils/constants";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("UIManager", () => {
	let mockPlugin: SandboxNotePlugin;
	let uiManager: UIManager;

	beforeEach(() => {
		vi.clearAllMocks();

		mockPlugin = {
			addRibbonIcon: vi.fn(),
			addCommand: vi.fn(),
			activateSandboxView: vi.fn(),
			activateInMemoryView: vi.fn(),
			app: {
				workspace: {
					getActiveViewOfType: vi.fn(),
				},
			},
		} as unknown as SandboxNotePlugin;

		uiManager = new UIManager(mockPlugin);
	});

	it("should be defined", () => {
		expect(uiManager).toBeDefined();
	});

	describe("setupUserInterface", () => {
		it("should add the ribbon icon with the correct parameters", () => {
			uiManager.setupUserInterface();

			expect(mockPlugin.addRibbonIcon).toHaveBeenCalledTimes(2);
			expect(mockPlugin.addRibbonIcon).toHaveBeenCalledWith(
				SANDBOX_NOTE_ICON,
				"Open sandbox note",
				expect.any(Function)
			);
			expect(mockPlugin.addRibbonIcon).toHaveBeenCalledWith(
				IN_MEMORY_NOTE_ICON,
				"Open in-memory note",
				expect.any(Function)
			);
		});

		it("should add the commands with the correct parameters", () => {
			uiManager.setupUserInterface();

			expect(mockPlugin.addCommand).toHaveBeenCalledTimes(3);

			expect(mockPlugin.addCommand).toHaveBeenCalledWith({
				id: "open-sandbox-note-view",
				name: "Open sandbox note",
				icon: SANDBOX_NOTE_ICON,
				callback: expect.any(Function),
			});

			expect(mockPlugin.addCommand).toHaveBeenCalledWith({
				id: "open-in-memory-note-view",
				name: "Open in-memory note",
				icon: IN_MEMORY_NOTE_ICON,
				callback: expect.any(Function),
			});

			expect(mockPlugin.addCommand).toHaveBeenCalledWith({
				id: "save-note",
				name: "Save current note",
				checkCallback: expect.any(Function),
			});
		});

		it("should call activateSandboxView when the sandbox ribbon icon callback is executed", () => {
			uiManager.setupUserInterface();

			const sandboxRibbonCallback = (
				mockPlugin.addRibbonIcon as ReturnType<typeof vi.fn>
			).mock.calls.find((call) => call[1] === "Open sandbox note")?.[2];
			sandboxRibbonCallback();

			expect(mockPlugin.activateSandboxView).toHaveBeenCalledOnce();
		});

		it("should call activateInMemoryView when the in-memory ribbon icon callback is executed", () => {
			uiManager.setupUserInterface();

			const inMemoryRibbonCallback = (
				mockPlugin.addRibbonIcon as ReturnType<typeof vi.fn>
			).mock.calls.find((call) => call[1] === "Open in-memory note")?.[2];
			inMemoryRibbonCallback();

			expect(mockPlugin.activateInMemoryView).toHaveBeenCalledOnce();
		});

		it("should call activateSandboxView when the sandbox command callback is executed", () => {
			uiManager.setupUserInterface();

			const sandboxCommandCallback = (
				mockPlugin.addCommand as ReturnType<typeof vi.fn>
			).mock.calls.find(
				(call) => call[0].id === "open-sandbox-note-view"
			)?.[0].callback;
			sandboxCommandCallback();

			expect(mockPlugin.activateSandboxView).toHaveBeenCalledOnce();
		});

		it("should call activateInMemoryView when the in-memory command callback is executed", () => {
			uiManager.setupUserInterface();

			const inMemoryCommandCallback = (
				mockPlugin.addCommand as ReturnType<typeof vi.fn>
			).mock.calls.find(
				(call) => call[0].id === "open-in-memory-note-view"
			)?.[0].callback;
			inMemoryCommandCallback();

			expect(mockPlugin.activateInMemoryView).toHaveBeenCalledOnce();
		});
	});
});
