import { beforeEach, describe, expect, it, vi } from "vitest";
import { UIManager } from "src/managers/uiManager";
import type InMemoryNotePlugin from "src/main";
import { IN_MEMORY_NOTE_ICON } from "src/utils/constants";

describe("UIManager", () => {
	let mockPlugin: InMemoryNotePlugin;
	let uiManager: UIManager;

	beforeEach(() => {
		vi.clearAllMocks();

		mockPlugin = {
			addRibbonIcon: vi.fn(),
			addCommand: vi.fn(),
			activateView: vi.fn(),
		} as unknown as InMemoryNotePlugin;

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
				IN_MEMORY_NOTE_ICON,
				"Open in-memory note",
				expect.any(Function),
			);
		});

		it("should add the command with the correct parameters", () => {
			uiManager.setupUserInterface();

			expect(mockPlugin.addCommand).toHaveBeenCalledOnce();
			expect(mockPlugin.addCommand).toHaveBeenCalledWith({
				id: "open-in-memory-note-view",
				name: "Open in-memory note",
				callback: expect.any(Function),
			});
		});

		it("should call activateView when the ribbon icon callback is executed", () => {
			uiManager.setupUserInterface();

			// Capture the callback from the mock call
			const callback = (mockPlugin.addRibbonIcon as ReturnType<typeof vi.fn>).mock.calls[0][2];
			callback();

			expect(mockPlugin.activateView).toHaveBeenCalledOnce();
		});

		it("should call activateView when the command callback is executed", () => {
			uiManager.setupUserInterface();

			// Capture the callback from the mock call
			const callback = (mockPlugin.addCommand as ReturnType<typeof vi.fn>).mock.calls[0][0].callback;
			callback();

			expect(mockPlugin.activateView).toHaveBeenCalledOnce();
		});
	});
});
