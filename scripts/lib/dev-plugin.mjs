// A plugin directory over this working copy, for `claude --plugin-dir`: one
// plugin named `harness` (the name the marketplace installs) carrying every
// skill and the core hooks, copied from the working tree when the run starts.
// Copied, not linked: Claude Code refuses a plugin path that resolves outside
// the plugin directory, and drops the hooks silently (skills still load from
// the default directory, so a linked plugin looks half alive). The repository
// root holds the marketplace manifest, so it cannot be the plugin directory.

import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function devPluginDir(repo) {
	const dir = mkdtempSync(join(tmpdir(), "harness-dev-plugin-"));
	mkdirSync(join(dir, ".claude-plugin"));
	// The same inline hooks the marketplace entry serves (scripts/build-hooks.mjs).
	const marketplace = JSON.parse(readFileSync(join(repo, ".claude-plugin", "marketplace.json"), "utf8"));
	const { hooks } = marketplace.plugins.find((p) => p.name === "harness");
	writeFileSync(
		join(dir, ".claude-plugin", "plugin.json"),
		`${JSON.stringify({ name: "harness", version: "0.0.0-dev", skills: "./skills/", hooks }, null, 2)}\n`,
	);
	const skip = (src) => !/[/\\](evals|node_modules)([/\\]|$)/.test(src);
	for (const d of ["skills", "hooks", "scripts"]) cpSync(join(repo, d), join(dir, d), { recursive: true, filter: skip });
	return dir;
}
