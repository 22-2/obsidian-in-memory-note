import { expect } from "@playwright/test";
import { testWithStarterPage, test } from "../base.mts";
import { VAULT_NAME } from "../config.mts";

test("test", async ({ starter }) => {
	expect(starter.window.url()).toContain("starter");
});
