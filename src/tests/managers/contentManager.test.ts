import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContentManager } from "src/managers/contentManager";
import type { InMemoryNoteView } from "src/view";
import type InMemoryNotePlugin from "src/main";
import type { DirectLogger } from "src/utils/logging";

// Helper to create a mock view
const createMockView = (): InMemoryNoteView => ({
	setContent: vi.fn(),
	leaf: {
		updateHeader: vi.fn(),
	},
	// Add other properties and methods as needed for tests
} as unknown as InMemoryNoteView);

// Mock logger
const mockLogger = {
	info: vi.fn(),
	error: vi.fn(),
} as unknown as DirectLogger;

// Mock plugin
const mockPlugin = {} as InMemoryNotePlugin;

describe("ContentManager", () => {
	let contentManager: ContentManager;
	let view1: InMemoryNoteView;
	let view2: InMemoryNoteView;
	let view3: InMemoryNoteView;

	beforeEach(() => {
		// Reset mocks and create new instances for each test
		vi.clearAllMocks();
		contentManager = new ContentManager(mockPlugin, mockLogger);
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
				contentManager.updateNoteContent(newContent, view1),
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
			expect(() =>
				contentManager.refreshAllViewTitles(),
			).not.toThrow();
		});
	});
});
