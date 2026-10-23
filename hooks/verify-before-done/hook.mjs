#!/usr/bin/env node
// Stop hook: the verify-before-done check Railly's verify-setup kit is built
// for (its fresh.sh "is called by the Stop hook"), which Railly does not
// publish. While .agents/verify/contract.md exists, the session may not stop
// until fresh.sh passes for the exact tree; in a harnessed repository, a session
// that edited files without a contract may not stop either. Exit 2 blocks the
// stop and hands the model the reason.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transcriptEdited, verifyBeforeDone } from "../../scripts/lib/hooks.mjs";

function repoRoot(cwd) {
	const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" });
	return r.status === 0 ? r.stdout.trim() : null;
}

function main() {
	let input = {};
	try {
		input = JSON.parse(readFileSync(0, "utf8"));
	} catch {
		// Malformed stdin: let the session stop rather than trap it.
	}
	const root = repoRoot(input.cwd || process.cwd());
	// The session's own edits: its transcript and its subagents' (an implementer edits there).
	const sessionEdited = () => {
		const main = input.transcript_path;
		if (!main || !existsSync(main)) return false;
		if (transcriptEdited(readFileSync(main, "utf8"))) return true;
		const subagents = join(main.replace(/\.jsonl$/, ""), "subagents");
		return existsSync(subagents) && readdirSync(subagents).some((f) => transcriptEdited(readFileSync(join(subagents, f), "utf8")));
	};
	const reason = verifyBeforeDone(
		input,
		root,
		(kit) => spawnSync("bash", [`${kit}/fresh.sh`], { cwd: root, encoding: "utf8", timeout: 60_000 }),
		sessionEdited,
	);
	if (!reason) return;
	process.stderr.write(`${reason}\n`);
	process.exit(2);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
