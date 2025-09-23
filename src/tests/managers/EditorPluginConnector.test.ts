import type SandboxNotePlugin from "src/main";
import { EditorPluginConnector } from "src/managers/EditorPluginConnector";
import { syncEditorPlugin } from "src/views/internal/SyncEditorPlugin";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "src/utils/EventEmitter";
import type { AppEvents } from "src/events/AppEvents";
import type { AbstractNoteView } from "src/views/internal/AbstractNoteView";

describe("EditorPluginConnector", () => {
	let mockPlugin: SandboxNotePlugin;
	let editorPluginConnector: EditorPluginConnector;
	let mockEmitter: EventEmitter<AppEvents>;

	beforeEach(() => {
		vi.clearAllMocks();

		mockEmitter = new EventEmitter<AppEvents>();
		mockPlugin = {
			registerEditorExtension: vi.fn(),
		} as unknown as SandboxNotePlugin;

		editorPluginConnector = new EditorPluginConnector(
			mockPlugin,
			mockEmitter
		);
	});

	it("should be defined", () => {
		expect(editorPluginConnector).toBeDefined();
	});

	describe("setupEditorExtension", () => {
		it("should register the watchEditorPlugin", () => {
			editorPluginConnector.setupEditorExtension();

			expect(mockPlugin.registerEditorExtension).toHaveBeenCalledOnce();
			expect(mockPlugin.registerEditorExtension).toHaveBeenCalledWith(
				syncEditorPlugin
			);
		});
	});

	describe("connectEditorPluginToView", () => {
		let mockView: AbstractNoteView;
		let mockCmPlugin: { connectToPlugin: ReturnType<typeof vi.fn> };

		beforeEach(() => {
			mockCmPlugin = {
				connectToPlugin: vi.fn(),
			};

			mockView = {
				editor: {
					cm: {
						plugin: vi.fn().mockReturnValue(mockCmPlugin),
					},
				},
			} as unknown as AbstractNoteView;
		});

		it("should get the plugin instance and connect it to the view", () => {
			editorPluginConnector.connectEditorPluginToView(mockView);

			// Check that we tried to get the correct plugin
			expect(mockView.editor.cm.plugin).toHaveBeenCalledOnce();
			expect(mockView.editor.cm.plugin).toHaveBeenCalledWith(
				syncEditorPlugin
			);

			// Check that we connected the plugin to the view
			expect(mockCmPlugin.connectToPlugin).toHaveBeenCalledOnce();
			expect(mockCmPlugin.connectToPlugin).toHaveBeenCalledWith(
				mockPlugin,
				mockView,
				mockEmitter
			);
		});

		it("should not throw if the editor is not available", () => {
			// Arrange: set editor to undefined
			(mockView as any).editor = undefined;

			// Act & Assert
			expect(() => {
				editorPluginConnector.connectEditorPluginToView(mockView);
			}).not.toThrow();

			// Assert that connectToPlugin was not called
			expect(mockCmPlugin.connectToPlugin).not.toHaveBeenCalled();
		});

		it("should not throw if the editor plugin is not found", () => {
			// Arrange: mock the cm.plugin to return null
			(
				mockView.editor.cm.plugin as ReturnType<typeof vi.fn>
			).mockReturnValue(null);

			// Act & Assert
			expect(() => {
				editorPluginConnector.connectEditorPluginToView(mockView);
			}).not.toThrow();

			// Assert that connectToPlugin was not called
			expect(mockCmPlugin.connectToPlugin).not.toHaveBeenCalled();
		});
	});
});
