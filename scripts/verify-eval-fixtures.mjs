#!/usr/bin/env node
// Proves every eval fixture is the state it claims to be, before any model
// sees it. Each fixture eval declares a `verification` (a command and the exit
// code it must produce on the materialized fixture: a green suite, a failing
// version check). This materializes the fixture the way a run does (base
// committed, changed on top) and runs that command.
//
//   node scripts/verify-eval-fixtures.mjs [skill ...]
//
// Same contract as Railly's verify-eval-fixtures.mjs, over every skill in
// this repository instead of one deprecated suite, and runnable with node on
// Windows (commands go through the shell, so `npm` resolves to npm.cmd).

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { quoteForShell } from "./lib/claude-cli.mjs";
import { discoverSkills } from "./lib/skills.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wanted = process.argv.slice(2);

const skills = discoverSkills(REPO).filter((s) => wanted.length === 0 || wanted.includes(s.name));
if (wanted.length && skills.length !== wanted.length) {
	const known = new Set(skills.map((s) => s.name));
	console.error(`no skill named ${wanted.filter((w) => !known.has(w)).join(", ")}`);
	process.exit(1);
}

const scratch = mkdtempSync(join(tmpdir(), "harness-fixtures-"));
let checked = 0;
let failed = 0;
try {
	for (const skill of skills) {
		const evalsFile = join(skill.root, "evals", "evals.json");
		let suite;
		try {
			suite = JSON.parse(readFileSync(evalsFile, "utf8"));
		} catch {
			continue; // validate-skills.mjs reports a missing or malformed suite
		}
		for (const item of (suite.evals ?? []).filter((e) => e.fixture)) {
			const label = `${skill.name}/${item.fixture} (${item.name})`;
			if (!item.verification) {
				console.log(`  – ${label}: no verification declared`);
				continue;
			}
			checked++;
			const dest = join(scratch, skill.name, item.name);
			const setup = spawnSync(process.execPath, [join(REPO, "scripts", "setup-eval-fixture.mjs"), skill.name, item.fixture, dest], {
				encoding: "utf8",
			});
			if (setup.status !== 0) {
				failed++;
				console.log(`  ✖ ${label}: fixture setup failed\n${setup.stderr}`);
				continue;
			}
			const command = item.verification.command.map(quoteForShell).join(" ");
			const run = spawnSync(command, [], { cwd: dest, encoding: "utf8", shell: true });
			if (run.status !== item.verification.expected_exit) {
				failed++;
				const tail = `${run.stdout}\n${run.stderr}`.trim().split(/\r?\n/).slice(-8).join("\n    ");
				console.log(`  ✖ ${label}: \`${command}\` expected exit ${item.verification.expected_exit}, got ${run.status}\n    ${tail}`);
				continue;
			}
			console.log(`  ✔ ${label}: \`${command}\` exits ${run.status}`);
		}
	}
} finally {
	rmSync(scratch, { recursive: true, force: true });
}

console.log(`\n${checked - failed}/${checked} fixture verification(s) hold`);
if (failed) process.exit(1);
