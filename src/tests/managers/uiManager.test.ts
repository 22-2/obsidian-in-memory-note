import { beforeEach, describe, expect, it, vi } from "vitest";
import { UIManager } from "src/managers/uiManager";
import type SandboxNotePlugin from "src/main";
import { SANDBOX_NOTE_ICON } from "src/utils/constants";

describe("UIManager", () => {
	let mockPlugin: SandboxNotePlugin;
	let uiManager: UIManager;

	beforeEach(() => {
		vi.clearAllMocks();

		mockPlugin = {
			addRibbonIcon: vi.fn(),
			addCommand: vi.fn(),
			activateView: vi.fn(),
		} as unknown as SandboxNotePlugin;

		uiManager = new UIManager(mockPlugin);
	});

	it("should be defined", () => {
		expect(uiManager).toBeDefined();
	});

	describe("setupUserInterface", () => {
		it("should add the ribbon icon with the correct parameters", () => {
			uiManager.setupUserInterface();

			expect(mockPlugin.addRibbonIcon).toHaveBeenCalledOnce();
			expect(mockPlugin.addRibbonIcon).toHaveBeenCalledWith(
				SANDBOX_NOTE_ICON,
				"Open sandbox note",
				expect.any(Function)
			);
		});

		it("should add the commands with the correct parameters", () => {
			uiManager.setupUserInterface();

			expect(mockPlugin.addCommand).toHaveBeenCalledTimes(2);

			expect(mockPlugin.addCommand).toHaveBeenCalledWith({
				id: "open-sandbox-note-view",
				name: "Open sandbox note",
				callback: expect.any(Function),
			});

			expect(mockPlugin.addCommand).toHaveBeenCalledWith({
				id: "save-sandbox",
				name: "Save current sandbox",
				checkCallback: expect.any(Function),
			});
		});

		it("should call activateView when the ribbon icon callback is executed", () => {
			uiManager.setupUserInterface();

			// Capture the callback from the mock call
			const callback = (
				mockPlugin.addRibbonIcon as ReturnType<typeof vi.fn>
			).mock.calls[0][2];
			callback();

			expect(mockPlugin.activateView).toHaveBeenCalledOnce();
		});

		it("should call activateView when the command callback is executed", () => {
			uiManager.setupUserInterface();

			// Capture the callback from the mock call
			const callback = (mockPlugin.addCommand as ReturnType<typeof vi.fn>)
				.mock.calls[0][0].callback;
			callback();

			expect(mockPlugin.activateView).toHaveBeenCalledOnce();
		});
	});
});
