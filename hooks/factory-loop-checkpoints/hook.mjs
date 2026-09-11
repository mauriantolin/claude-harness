#!/usr/bin/env node
// PostToolUse hook, matcher `Skill`: when the call that just completed loaded
// factory-loop, inject addendum.md as additional context. Railly's SKILL.md is
// never modified; the addendum rides alongside it at load time.
//
// Registered in ~/.claude/settings.json by hand (doctor.mjs checks it), and
// linked into ~/.claude/hooks/ by install.sh as a launcher, so an edit to
// addendum.md is live in the next factory-loop load.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { factoryLoopCheckpoint } from "../../scripts/lib/hooks.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

export function readAddendum() {
	return readFileSync(join(HERE, "addendum.md"), "utf8").trim();
}

function main() {
	let input = null;
	try {
		input = JSON.parse(readFileSync(0, "utf8"));
	} catch {
		// No or malformed stdin: nothing to decide on, and a hook that throws
		// would surface as a hook error on every Skill call.
	}
	const out = factoryLoopCheckpoint(input, readAddendum());
	if (out) process.stdout.write(`${JSON.stringify(out)}\n`);
}

// Run only when executed directly (or through the install.sh launcher, which
// spawns this file by path); importing the module for a test stays silent.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
