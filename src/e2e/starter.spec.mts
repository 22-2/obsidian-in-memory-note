import { testWithStarterPage } from "./base.mts";
import { VAULT_NAME } from "./config.mts";

testWithStarterPage("test", async ({ obsidian }) => {
	obsidian.window.getByText(VAULT_NAME, { exact: true }).isVisible();
});
