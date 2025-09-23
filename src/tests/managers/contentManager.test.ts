import type SandboxNotePlugin from "src/main";
import { ContentManager } from "src/managers/ContentManager";
import type { SandboxNoteView } from "src/views/SandboxNoteView";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Helper to create a mock view
const createMockView = (): SandboxNoteView =>
	({
		setContent: vi.fn(),
		leaf: {
			updateHeader: vi.fn(),
		},
		getViewType: vi.fn().mockReturnValue("sandbox-note"),
		// Add other properties and methods as needed for tests
	} as unknown as SandboxNoteView);

// Mock logger
const mockLogger = {
	info: vi.fn(),
	error: vi.fn(),
	debug: vi.fn(),
};

// Mock plugin
const mockPlugin = {} as SandboxNotePlugin;

describe("ContentManager", () => {
	let contentManager: ContentManager;
	let view1: SandboxNoteView;
	let view2: SandboxNoteView;
	let view3: SandboxNoteView;

	beforeEach(() => {
		// Reset mocks and create new instances for each test
		vi.clearAllMocks();
		contentManager = new ContentManager(mockPlugin);
		view1 = createMockView();
		view2 = createMockView();
		view3 = createMockView();
	});

	it("should be defined", () => {
		expect(contentManager).toBeDefined();
	});

	describe("View Management", () => {
		it("should add an active view", () => {
			contentManager.addActiveView(view1);
			expect(contentManager.activeViews.has(view1)).toBe(true);
			expect(contentManager.activeViews.size).toBe(1);
		});

		it("should remove an active view", () => {
			contentManager.addActiveView(view1);
			contentManager.addActiveView(view2);
			contentManager.removeActiveView(view1);
			expect(contentManager.activeViews.has(view1)).toBe(false);
			expect(contentManager.activeViews.has(view2)).toBe(true);
			expect(contentManager.activeViews.size).toBe(1);
		});
	});

	describe("updateNoteContent", () => {
		beforeEach(() => {
			contentManager.addActiveView(view1);
			contentManager.addActiveView(view2);
			contentManager.addActiveView(view3);
		});

		it("should update the shared content", () => {
			const newContent = "This is the new shared content.";
			contentManager.updateNoteContent(newContent, view1);
			expect(contentManager.sharedNoteContent).toBe(newContent);
		});

		it("should synchronize content to all other views", () => {
			const newContent = "Sync this content!";
			contentManager.updateNoteContent(newContent, view1);

			// The source view should not be updated
			expect(view1.setContent).not.toHaveBeenCalled();

			// Other views should be updated
			expect(view2.setContent).toHaveBeenCalledTimes(1);
			expect(view2.setContent).toHaveBeenCalledWith(newContent);
			expect(view3.setContent).toHaveBeenCalledTimes(1);
			expect(view3.setContent).toHaveBeenCalledWith(newContent);
		});

		it("should not fail if there are no other views", () => {
			// Only one view is active
			contentManager.removeActiveView(view2);
			contentManager.removeActiveView(view3);

			const newContent = "Content for a single view.";
			expect(() =>
				contentManager.updateNoteContent(newContent, view1)
			).not.toThrow();
			expect(contentManager.sharedNoteContent).toBe(newContent);
		});
	});

	describe("refreshAllViewTitles", () => {
		it("should call updateHeader on all active views", () => {
			contentManager.addActiveView(view1);
			contentManager.addActiveView(view2);

			contentManager.refreshAllViewTitles();

			expect(view1.leaf.updateHeader).toHaveBeenCalledTimes(1);
			expect(view2.leaf.updateHeader).toHaveBeenCalledTimes(1);
		});

		it("should not fail if there are no active views", () => {
			expect(() => contentManager.refreshAllViewTitles()).not.toThrow();
		});
	});
});
