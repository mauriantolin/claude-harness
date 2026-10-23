#!/usr/bin/env node
// PostToolUse hook, matcher `Skill`: when the call that just completed loaded
// Railly's loop or contract, inject bindings.md as additional context. Railly's
// SKILL.md is never modified; the bindings ride alongside it at load time.
//
// Served by the core plugin (hooks/core.json), so an edit to bindings.md is
// live in the next loop load of every repository that enables the plugin.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loopBindings } from "../../scripts/lib/hooks.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

function main() {
	let input = null;
	try {
		input = JSON.parse(readFileSync(0, "utf8"));
	} catch {
		// No or malformed stdin: nothing to decide on, and a hook that throws
		// would surface as a hook error on every Skill call.
	}
	const out = loopBindings(input, readFileSync(join(HERE, "bindings.md"), "utf8").trim());
	if (out) process.stdout.write(`${JSON.stringify(out)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
