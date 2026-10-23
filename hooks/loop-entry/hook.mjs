#!/usr/bin/env node
// UserPromptSubmit hook: in a repository with .agents/harness.md, tells the agent that a change
// enters through Railly's loop. Without it the loop stayed dormant on plainly worded requests, and
// every later step (contract, bindings, observation, gate) depends on that entry.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loopEntry } from "../../scripts/lib/hooks.mjs";

function main() {
	let input = {};
	try {
		input = JSON.parse(readFileSync(0, "utf8"));
	} catch {}
	const top = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: input.cwd || process.cwd(), encoding: "utf8" });
	const out = loopEntry(top.status === 0 ? top.stdout.trim() : null);
	if (out) process.stdout.write(`${JSON.stringify(out)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
