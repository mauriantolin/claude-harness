#!/usr/bin/env node
// PreToolUse hook, matcher Write|Edit|MultiEdit|Bash: blocks an edit to a surface whose owning
// skills (the `routes` block of .agents/routing.md) this agent has not loaded. The route step's
// "load the owners before the first edit" becomes a check every agent meets, a subagent included:
// its own transcript is the one read, since a skill the orchestrator loaded is not in its context.
//
// The repository is the one of the edited file, not of the hook's cwd: a Workflow subagent edits a
// worktree under ~/wt/ from a session that sits in another checkout. A Bash command that writes
// (sed -i, a redirection, tee, an interpreter running code that names the file) is checked too.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bashWrites, loadedSkills, parseRoutes, routeGuardPath } from "../../scripts/lib/hooks.mjs";

const read = (f) => (f && existsSync(f) ? readFileSync(f, "utf8") : "");
const readSmall = (f) => {
	try {
		return statSync(f).size < 256 * 1024 ? readFileSync(f, "utf8") : "";
	} catch {
		return "";
	}
};

// The git toplevel of a path, from its nearest existing folder (a Write creates new files).
const roots = new Map();
function rootOf(file) {
	let dir = dirname(file);
	while (dir !== "/" && !existsSync(dir)) dir = dirname(dir);
	if (!roots.has(dir)) {
		const top = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: dir, encoding: "utf8" });
		roots.set(dir, top.status === 0 ? top.stdout.trim() : null);
	}
	return roots.get(dir);
}

// A subagent's transcript: beside the session's (`subagents/agent-<id>.jsonl`) or, for an agent of
// a Workflow, under `subagents/workflows/<run>/`.
function ownTranscript(main, agentId) {
	if (!agentId || !main) return null;
	const base = join(main.replace(/\.jsonl$/, ""), "subagents");
	const direct = join(base, `agent-${agentId}.jsonl`);
	if (existsSync(direct)) return direct;
	const runs = join(base, "workflows");
	if (!existsSync(runs)) return null;
	for (const run of readdirSync(runs)) {
		const f = join(runs, run, `agent-${agentId}.jsonl`);
		if (existsSync(f)) return f;
	}
	return null;
}

function main() {
	let input = {};
	try {
		input = JSON.parse(readFileSync(0, "utf8"));
	} catch {
		return;
	}
	const cwd = input.cwd || process.cwd();
	const files =
		input.tool_name === "Bash"
			? bashWrites(input.tool_input?.command, cwd, readSmall)
			: [input.tool_input?.file_path].filter((f) => typeof f === "string").map((f) => resolve(cwd, f));
	if (!files.length) return;
	const own = ownTranscript(input.transcript_path, input.agent_id);
	const loaded = loadedSkills(own ? read(own) : read(input.transcript_path));
	const routesOf = new Map();
	for (const file of files) {
		const root = rootOf(file);
		if (!root) continue;
		if (!routesOf.has(root)) routesOf.set(root, parseRoutes(read(join(root, ".agents", "routing.md"))));
		const reason = routeGuardPath(file, root, routesOf.get(root), loaded);
		if (!reason) continue;
		process.stderr.write(`${reason}${input.tool_name === "Bash" ? "\nThe command writes or runs code that names that file; editing through Bash meets the same rule." : ""}\n`);
		process.exit(2);
	}
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
