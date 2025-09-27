import { expect } from "@playwright/test";
import { test } from "../../test-fixtures.mts";

test("playground", async ({ starter }) => {
	await starter.window.pause();
});
