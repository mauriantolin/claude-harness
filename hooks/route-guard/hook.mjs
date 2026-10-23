#!/usr/bin/env node
// PreToolUse hook, matcher Write|Edit|MultiEdit: blocks an edit to a surface whose owning skills
// (the `routes` block of .agents/routing.md) this agent has not loaded. The route step's
// "load the owners before the first edit" becomes a check every agent meets, a subagent included:
// its own transcript is the one read, since a skill the orchestrator loaded is not in its context.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadedSkills, parseRoutes, routeGuard } from "../../scripts/lib/hooks.mjs";

const read = (f) => (f && existsSync(f) ? readFileSync(f, "utf8") : "");

function main() {
	let input = {};
	try {
		input = JSON.parse(readFileSync(0, "utf8"));
	} catch {
		return;
	}
	const top = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: input.cwd || process.cwd(), encoding: "utf8" });
	if (top.status !== 0) return;
	const root = top.stdout.trim();
	const routes = parseRoutes(read(join(root, ".agents", "routing.md")));
	if (!routes.length) return;
	// A subagent's calls carry its agent_id; its transcript sits beside the session's.
	const main = input.transcript_path;
	const own = input.agent_id && main ? join(main.replace(/\.jsonl$/, ""), "subagents", `agent-${input.agent_id}.jsonl`) : null;
	const transcript = own && existsSync(own) ? read(own) : read(main);
	const reason = routeGuard(input, root, routes, loadedSkills(transcript));
	if (!reason) return;
	process.stderr.write(`${reason}\n`);
	process.exit(2);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
