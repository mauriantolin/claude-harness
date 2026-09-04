import { test } from "node:test";
import assert from "node:assert/strict";
import { quoteForShell } from "./claude-cli.mjs";

test("quoteForShell leaves plain args alone and quotes spaces and quotes", () => {
	assert.equal(quoteForShell("-p"), "-p");
	assert.equal(quoteForShell("C:\\Users\\me\\a dir"), '"C:\\Users\\me\\a dir"');
	assert.equal(quoteForShell('say "hi"'), '"say \\"hi\\""');
});
