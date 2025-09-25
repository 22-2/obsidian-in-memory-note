import { App, Modal, Setting } from "obsidian";

export function showConfirmModal(
	app: App,
	title: string,
	message: string
): Promise<boolean> {
	return new Promise((resolve) => {
		new ConfirmModal(app, title, message, (result) => {
			resolve(result);
		}).open();
	});
}

class ConfirmModal extends Modal {
	constructor(
		app: App,
		public title: string,
		public message: string,
		public callback: (result: boolean) => void
	) {
		super(app);
		this.title = title;
		this.message = message;
		this.callback = callback;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: this.title });
		contentEl.createEl("p", { text: this.message });

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Yes")
					.setCta()
					.onClick(() => {
						this.callback(true);
						this.close();
					})
			)
			.addButton((btn) =>
				btn.setButtonText("No").onClick(() => {
					this.callback(false);
					this.close();
				})
			);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
