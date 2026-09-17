#!/usr/bin/env node
// Materializes one eval fixture as a real git repository.
//
//   node scripts/setup-eval-fixture.mjs <skill> <fixture> <destination> [fixtures-root]
//
// `base/` is copied in and committed, then `changed/` is copied over it and
// left uncommitted, so the run starts on a repository with a live diff. A
// fixture without `changed/` is a clean repository, which is the right start
// for a scenario about branching rather than about a pending diff.
//
// A fixture belongs to the skill it exercises:
//   skills/[.experimental/]<skill>/evals/fixtures/<fixture>/{base,changed}
// or, for a skill this repository does not author, to the suite that measures
// it, whose fixtures root is passed explicitly (hooks/<name>/evals/fixtures).

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { skillDir } from "./lib/skills.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [skillName, fixtureName, destinationArg, fixturesRootArg] = process.argv.slice(2);

if (!skillName || !fixtureName || !destinationArg) {
	console.error("usage: node scripts/setup-eval-fixture.mjs <skill> <fixture> <destination>");
	process.exit(1);
}

const skillRoot = fixturesRootArg ? null : skillDir(REPO, skillName);
if (!fixturesRootArg && !skillRoot) {
	console.error(`no skill named "${skillName}"`);
	process.exit(1);
}
const root = fixturesRootArg ? join(resolve(fixturesRootArg), fixtureName) : join(skillRoot, "evals", "fixtures", fixtureName);
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

const git = (...args) => execFileSync("git", args, { cwd: destination, encoding: "utf8", stdio: "pipe" });
git("init", "-q", "-b", "main");
git("config", "user.name", "Skill Eval");
git("config", "user.email", "eval@example.invalid");
git("config", "commit.gpgsign", "false");
git("add", ".");
git("commit", "-qm", "fixture base");

if (existsSync(changed)) cpSync(changed, destination, { recursive: true });

console.log(destination);
