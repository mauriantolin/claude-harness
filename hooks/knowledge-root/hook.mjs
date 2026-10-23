#!/usr/bin/env node
// SessionStart hook: in a harnessed repository (one with .agents/), point
// Railly's canonical source root at .agents/knowledge and create the markers
// his resolver validates. The variable goes to CLAUDE_ENV_FILE, so every Bash
// command of the session (where gate and correct run their scripts) sees it.
// A clone or a fresh worktree needs nothing else: no settings.local.json.
//
// .agents/knowledge holds local run evidence (cases, gate run reports) and is
// ignored by the repository; durable lessons go where the repository says.

import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { KNOWLEDGE_MARKERS, knowledgeRoot } from "../../scripts/lib/hooks.mjs";

function main() {
	let input = {};
	try {
		input = JSON.parse(readFileSync(0, "utf8"));
	} catch {}
	const top = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: input.cwd || process.cwd(), encoding: "utf8" });
	const root = knowledgeRoot(top.status === 0 ? top.stdout.trim() : null);
	if (!root) return;
	for (const [path, body] of Object.entries(KNOWLEDGE_MARKERS)) {
		const file = join(root, path);
		if (existsSync(file)) continue;
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, body);
	}
	if (process.env.CLAUDE_ENV_FILE) appendFileSync(process.env.CLAUDE_ENV_FILE, `export RAILLY_SKILLS_REPO='${root}'\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
