#!/usr/bin/env node
// Generates hooks/core.json, the hook configuration the core plugin serves,
// from hooks/events.json, the one table of which event each hook runs on.
//
//   node scripts/build-hooks.mjs          write hooks/core.json
//   node scripts/build-hooks.mjs --check  exit 1 when core.json is stale

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOOKS = join(REPO, "hooks");

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
	return { description: "claude-harness core hooks, generated from hooks/events.json", hooks };
}

const entryOf = (name) => (existsSync(join(HOOKS, name, "hook.mjs")) ? "hook.mjs" : "hook.sh");

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const events = JSON.parse(readFileSync(join(HOOKS, "events.json"), "utf8"));
	const body = `${JSON.stringify(buildHooks(events, entryOf), null, "\t")}\n`;
	const out = join(HOOKS, "core.json");
	if (process.argv.includes("--check")) {
		const current = existsSync(out) ? readFileSync(out, "utf8") : "";
		if (current !== body) {
			console.error("hooks/core.json is stale: run node scripts/build-hooks.mjs");
			process.exit(1);
		}
	} else writeFileSync(out, body);
}
