import log from "loglevel";
import type { Page } from "playwright";

export const delay = async (milliseconds: number): Promise<void> => {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

const SEL_PALETTE_RESULTS = ".prompt-results";
const SEL_PALETTE_ITEM = ".suggestion-item";

export const CMD_CREATE_FILE = "Lineage Dev: Create new document";
export const CMD_CLOSE_OTHER_TABS = "Close all other tabs";
export const CMD_CLOSE_THIS_TAB_GROUP = "Close this tab group";
export const CMD_CLOSE_CURRENT_TAB = "Close current tab";
export const CMD_UNDO_CLOSE_TAB = "Undo close tab";
export const CMD_GO_TO_PREVIOUS_TAB = "Go to previous tab";
export const CMD_GO_TO_NEXT_TAB = "Go to next tab";
export const OPEN_SANDBOX_VAULT = "Open sandbox vault";

const logger = log.getLogger("run-commands");

export const PROMPT_INPUT = ".prompt-input";
export const runCommand = async (
	page: Page,
	commandName: string,
	required = true
) => {
	logger.debug("runCommand", commandName);
	const success = await page.evaluate((commandName) => {
		const command = app.commands
			.listCommands()
			.find((c) => c.name === commandName);
		if (command) {
			app.commands.executeCommandById(command.id);
			return true;
		}
	}, commandName);
	expect(success).toBe(true);
	await delay(1000);
};
