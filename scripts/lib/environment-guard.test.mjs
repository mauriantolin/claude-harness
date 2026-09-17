import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { diffSnapshots, snapshotDirs } from "./environment-guard.mjs";

test("an unchanged environment has no differences", () => {
	const s = { "/a": ["x", "y"], "/b": null };
	assert.deepEqual(diffSnapshots(s, { "/a": ["x", "y"], "/b": null }), []);
});

test("an installed and a removed skill are both reported, per directory", () => {
	const changes = diffSnapshots({ "/a": ["x"], "/b": ["old"] }, { "/a": ["x", "new-skill"], "/b": [] });
	assert.deepEqual(changes, [
		{ dir: "/a", added: ["new-skill"], removed: [] },
		{ dir: "/b", added: [], removed: ["old"] },
	]);
});

test("a directory created by the run counts as additions", () => {
	assert.deepEqual(diffSnapshots({ "/a": null }, { "/a": ["s"] }), [{ dir: "/a", added: ["s"], removed: [] }]);
});

test("snapshotDirs lists real entries and marks a missing directory null", () => {
	const root = mkdtempSync(join(tmpdir(), "guard-"));
	try {
		mkdirSync(join(root, "skills", "b"), { recursive: true });
		mkdirSync(join(root, "skills", "a"));
		const missing = join(root, "nope");
		assert.deepEqual(snapshotDirs([join(root, "skills"), missing]), { [join(root, "skills")]: ["a", "b"], [missing]: null });
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
