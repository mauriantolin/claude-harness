// A real repository as an eval fixture: a local clone of `source` at its working state (HEAD plus
// what is staged and modified, captured with `git stash create`, which touches no ref and no file
// of the source), with `origin/<base>` where the source has it and `origin` pointing at an empty
// bare repository. A push that escapes every guard lands in that bare repository, never on the
// source's real remote. `setup` commands (an install) run in the clone before the agent does.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

export function repoFixture({ source, base = "dev", setup = [], changes = {}, edits = [] }, dest, write) {
	// `stash create` refreshes the source's index, so two runners starting at once collide on its
	// index.lock: retry instead of failing the run.
	let state = "";
	for (let attempt = 0; ; attempt++) {
		try {
			state = git(source, "stash", "create") || git(source, "rev-parse", "HEAD");
			break;
		} catch (error) {
			if (attempt >= 20 || !String(error.stderr).includes("index.lock")) throw error;
			execFileSync("sleep", ["0.5"]);
		}
	}
	const bare = `${dest}-origin.git`;
	execFileSync("git", ["init", "-q", "--bare", bare]);
	execFileSync("git", ["clone", "-q", "--shared", "--no-checkout", source, dest]);
	git(dest, "remote", "set-url", "origin", bare);
	git(dest, "config", "user.name", "Skill Eval");
	git(dest, "config", "user.email", "eval@example.invalid");
	git(dest, "config", "commit.gpgsign", "false");
	try {
		git(dest, "update-ref", `refs/remotes/origin/${base}`, git(source, "rev-parse", `origin/${base}`));
	} catch {}
	git(dest, "checkout", "-q", "-b", "eval-work", state);
	git(dest, "reset", "-q", "--soft", git(dest, "rev-parse", `${state}^1`));
	git(dest, "commit", "-q", "--allow-empty", "-m", "eval fixture: working state of the source");
	for (const [path, body] of Object.entries(changes)) {
		mkdirSync(join(dest, path, ".."), { recursive: true });
		write(join(dest, path), body);
	}
	// `edits`: [path, find, replace], the starting diff the eval needs (a planted bug, a pending
	// change), left uncommitted like work in progress.
	for (const [path, find, replace] of edits) {
		const file = join(dest, path);
		const body = readFileSync(file, "utf8");
		if (!body.includes(find)) throw new Error(`fixture edit: ${path} does not contain ${JSON.stringify(find)}`);
		write(file, body.replace(find, replace));
	}
	for (const cmd of setup) execFileSync(cmd[0], cmd.slice(1), { cwd: dest, stdio: "pipe", timeout: 15 * 60_000 });
	return dest;
}
