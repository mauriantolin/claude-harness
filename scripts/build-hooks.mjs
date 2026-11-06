#!/usr/bin/env node
// Writes the hooks the core plugin serves, generated from hooks/events.json (the one table of which
// event each hook runs on), inline into the `harness` entry of .claude-plugin/marketplace.json.
// Inline, as an object, because Claude Code does not load the file-path form from a marketplace
// entry: `"hooks": "./hooks/core.json"` installed with «Hook load failed: hooks: the file-path and
// array forms are not yet supported in a marketplace entry», and no harness hook ever ran. A
// hooks/hooks.json at the plugin root is no way out either: the other plugins of this marketplace
// share `source: "./"` and would serve the same hooks.
//
//   node scripts/build-hooks.mjs          write the hooks into marketplace.json
//   node scripts/build-hooks.mjs --check  exit 1 when marketplace.json is stale

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOOKS = join(REPO, "hooks");
const MARKETPLACE = join(REPO, ".claude-plugin", "marketplace.json");
const CORE = "harness";

export function buildHooks(events, entryOf) {
	const hooks = {};
	for (const [name, { event, matcher, timeout }] of Object.entries(events)) {
		const entry = entryOf(name);
		const command = entry.endsWith(".sh")
			? `bash "\${CLAUDE_PLUGIN_ROOT}/hooks/${name}/${entry}"`
			: `node "\${CLAUDE_PLUGIN_ROOT}/hooks/${name}/${entry}"`;
		const group = (hooks[event] ??= []).find((g) => (g.matcher ?? "") === matcher);
		const hook = { type: "command", command, timeout };
		if (group) group.hooks.push(hook);
		else hooks[event].push(matcher ? { matcher, hooks: [hook] } : { hooks: [hook] });
	}
	return hooks;
}

// The marketplace with the core plugin's `hooks` replaced by the built object.
export function withHooks(marketplace, hooks) {
	const plugins = marketplace.plugins.map((p) => (p.name === CORE ? { ...p, hooks } : p));
	if (!plugins.some((p) => p.name === CORE)) throw new Error(`no ${CORE} plugin in marketplace.json`);
	return { ...marketplace, plugins };
}

const entryOf = (name) => (existsSync(join(HOOKS, name, "hook.mjs")) ? "hook.mjs" : "hook.sh");

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const events = JSON.parse(readFileSync(join(HOOKS, "events.json"), "utf8"));
	const current = readFileSync(MARKETPLACE, "utf8");
	const body = `${JSON.stringify(withHooks(JSON.parse(current), buildHooks(events, entryOf)), null, 2)}\n`;
	if (process.argv.includes("--check")) {
		if (current !== body) {
			console.error(".claude-plugin/marketplace.json hooks are stale: run node scripts/build-hooks.mjs");
			process.exit(1);
		}
	} else writeFileSync(MARKETPLACE, body);
}
