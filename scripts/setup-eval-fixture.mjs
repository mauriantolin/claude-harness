#!/usr/bin/env node
// Materializes one eval fixture as a real git repository.
//
//   node scripts/setup-eval-fixture.mjs <skill> <fixture> <destination>
//
// Same shape as Railly's script — `base/` is copied in and committed, then
// `changed/` is copied over it and left uncommitted, so the run starts on a
// repository with a live diff. Rewritten because his resolves fixtures from
// `foundry/deprecated/unfold/evals/fixtures`, the directory of a retired skill,
// and takes no skill argument: every fixture in his tree belongs to that one
// deprecated suite.
//
// Here a fixture belongs to the skill it exercises:
//   skills/<skill>/evals/fixtures/<fixture>/{base,changed}

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const [skillName, fixtureName, destinationArg] = process.argv.slice(2);

if (!skillName || !fixtureName || !destinationArg) {
	console.error(
		"usage: node scripts/setup-eval-fixture.mjs <skill> <fixture> <destination>",
	);
	process.exit(1);
}

const root = join(REPO, "skills", skillName, "evals", "fixtures", fixtureName);
const base = join(root, "base");
const changed = join(root, "changed");
const destination = resolve(destinationArg);

if (!existsSync(base)) {
	console.error(`fixture has no base/: ${root}`);
	process.exit(1);
}

rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
cpSync(base, destination, { recursive: true });

const git = (...args) =>
	execFileSync("git", args, { cwd: destination, encoding: "utf8", stdio: "pipe" });

git("init", "-q");
git("config", "user.name", "Skill Eval");
git("config", "user.email", "eval@example.invalid");
git("config", "commit.gpgsign", "false");
git("add", ".");
git("commit", "-qm", "fixture base");

// A fixture without `changed/` is a clean repository, which is the right start
// for a scenario that is about branching rather than about a pending diff.
if (existsSync(changed)) {
	cpSync(changed, destination, { recursive: true });
}

console.log(destination);
