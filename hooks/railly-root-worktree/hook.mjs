#!/usr/bin/env node
// SessionStart hook: a git worktree created by a tool (orca, `git worktree add`)
// starts without the gitignored .claude/settings.local.json, so Railly's
// resolver finds no RAILLY_SKILLS_REPO and factory-loop refuses to start.
//
// When the session's repository has no RAILLY_SKILLS_REPO, copy the one the
// main worktree uses: missions, cases and handoffs of a repository live in one
// root, not in a worktree that is deleted when its branch lands. If the main
// worktree has none either, scaffold the repository with railly-inrepo.mjs.
//
// The variable is read at session start, so it takes effect from the next
// session; this one is told the path to use explicitly.
//
// Registered in ~/.claude/settings.json by hand (doctor.mjs checks it), and
// linked into ~/.claude/hooks/ by install.sh as a launcher.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

function git(cwd, ...args) {
	const r = spawnSync("git", args, { cwd, encoding: "utf8" });
	return r.status === 0 ? r.stdout.trim() : null;
}

function readSettings(path) {
	if (!existsSync(path)) return {};
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return null;
	}
}

export function ensureRoot(cwd) {
	const top = git(cwd, "rev-parse", "--show-toplevel");
	if (!top) return null;
	const settingsPath = join(top, ".claude", "settings.local.json");
	const settings = readSettings(settingsPath);
	// Unparseable settings are the user's to fix; never overwrite them.
	if (settings === null || settings.env?.RAILLY_SKILLS_REPO) return null;

	const common = git(top, "rev-parse", "--path-format=absolute", "--git-common-dir");
	const main = common ? dirname(resolve(common)) : null;
	const inherited =
		main && resolve(main) !== resolve(top)
			? readSettings(join(main, ".claude", "settings.local.json"))?.env?.RAILLY_SKILLS_REPO
			: null;

	if (inherited) {
		settings.env = { ...(settings.env || {}), RAILLY_SKILLS_REPO: inherited };
		// A worktree from `git worktree add` carries no .claude/ unless the
		// repository versions one, and writeFileSync does not create the
		// directory: without this the hook threw ENOENT at session start,
		// which is exactly when the variable was needed.
		mkdirSync(dirname(settingsPath), { recursive: true });
		writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
		return inherited;
	}
	const scaffold = join(HERE, "..", "..", "scripts", "railly-inrepo.mjs");
	const r = spawnSync(process.execPath, [scaffold, "scaffold", top], { encoding: "utf8" });
	return r.status === 0 ? join(top, ".claude", "knowledge") : null;
}

function main() {
	let input = null;
	try {
		input = JSON.parse(readFileSync(0, "utf8"));
	} catch {}
	// A hook that throws surfaces as a hook error at session start and leaves
	// the session without the variable anyway. Say which one happened.
	let root = null;
	try {
		root = ensureRoot(input?.cwd ?? process.cwd());
	} catch (e) {
		process.stdout.write(
			`${JSON.stringify({
				hookSpecificOutput: {
					hookEventName: "SessionStart",
					additionalContext: `RAILLY_SKILLS_REPO is missing for this repository and could not be written: ${e.message}. Railly's scripts will fail to resolve their source root until it is set.`,
				},
			})}\n`,
		);
		return;
	}
	if (!root) return;
	process.stdout.write(
		`${JSON.stringify({
			hookSpecificOutput: {
				hookEventName: "SessionStart",
				additionalContext: `RAILLY_SKILLS_REPO was missing for this repository and is now set in .claude/settings.local.json to ${root}. It is not in this session's environment yet: pass RAILLY_SKILLS_REPO=${root} explicitly when running Railly's scripts.`,
			},
		})}\n`,
	);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
