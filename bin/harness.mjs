#!/usr/bin/env node
// Brings this harness into a repository, so it travels with the repository instead of living in
// ~/.claude: whoever clones it and trusts the folder gets the same plugins, hooks and kit.
//
//   harness init [repo] [--design] [--maintainer] [--local]
//   harness check [repo]
//
// init writes, never overwriting a file that exists:
//   .claude/settings.json   the marketplaces and the plugins (Railly's stable and experimental,
//                           this repository's harness; --design and --maintainer add those)
//   .agents/verify/         Railly's verify-setup kit (doctor, check, observe, fresh, drivers)
//   .agents/harness.md      the repository's binding of the loop, from templates/
//   .agents/routing.md      the repository's routing table, from templates/
//   .gitignore              .agents/knowledge/ and .agents/verify/contract.md
// --local is for a repository you do not own: settings go to .claude/settings.local.json and
// every path goes to .git/info/exclude, so nothing is ever versioned.
//
// check reports what is missing or stale; it changes nothing.

import { spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAILLY = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "plugins", "marketplaces", "railly-skills");
const SCAFFOLD = join(RAILLY, "skills", ".experimental", "verify-setup", "scripts", "scaffold.mjs");

export const MARKETPLACES = {
	"railly-skills": { source: { source: "github", repo: "Railly/skills" } },
	"mauri-harness": { source: { source: "github", repo: "mauriantolin/claude-harness" } },
};
export const IGNORED = [".agents/knowledge/", ".agents/verify/contract.md"];

export function plugins({ design = false, maintainer = false } = {}) {
	return [
		"stable@railly-skills",
		"experimental@railly-skills",
		"harness@mauri-harness",
		...(design ? ["harness-design@mauri-harness"] : []),
		...(maintainer ? ["harness-maintainer@mauri-harness"] : []),
	];
}

// Adds what is missing, keeps every key the repository already has.
export function mergeSettings(settings, wanted) {
	const out = { ...settings };
	out.extraKnownMarketplaces = { ...MARKETPLACES, ...(settings.extraKnownMarketplaces ?? {}) };
	out.enabledPlugins = { ...(settings.enabledPlugins ?? {}) };
	for (const id of wanted) out.enabledPlugins[id] ??= true;
	return out;
}

const readJson = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {});
const git = (cwd, ...a) => spawnSync("git", a, { cwd, encoding: "utf8" });

function init(repo, opts) {
	const top = git(repo, "rev-parse", "--show-toplevel");
	if (top.status !== 0) throw new Error(`${repo} is not a git repository`);
	const root = top.stdout.trim();
	const done = [];

	const settingsFile = join(root, ".claude", opts.local ? "settings.local.json" : "settings.json");
	const before = readJson(settingsFile);
	const after = mergeSettings(before, plugins(opts));
	if (JSON.stringify(before) !== JSON.stringify(after)) {
		mkdirSync(dirname(settingsFile), { recursive: true });
		writeFileSync(settingsFile, `${JSON.stringify(after, null, 2)}\n`);
		done.push(`wrote ${settingsFile.slice(root.length + 1)}`);
	}

	if (!existsSync(join(root, ".agents", "verify"))) {
		if (!existsSync(SCAFFOLD)) throw new Error(`Railly's verify-setup scaffold not found at ${SCAFFOLD}: install the railly-skills marketplace first`);
		const r = spawnSync(process.execPath, [SCAFFOLD, root, ...(opts.local ? ["--local"] : [])], { encoding: "utf8" });
		if (r.status !== 0) throw new Error(`scaffold failed: ${r.stderr || r.stdout}`);
		done.push("scaffolded .agents/verify (Railly verify-setup)");
	}

	for (const name of ["harness.md", "routing.md"]) {
		const dest = join(root, ".agents", name);
		if (existsSync(dest)) continue;
		copyFileSync(join(HARNESS, "templates", name), dest);
		done.push(`seeded .agents/${name}`);
	}

	const ignoreFile = opts.local ? join(root, git(root, "rev-parse", "--git-dir").stdout.trim(), "info", "exclude") : join(root, ".gitignore");
	const lines = existsSync(ignoreFile) ? readFileSync(ignoreFile, "utf8").split(/\r?\n/) : [];
	const missing = (opts.local ? [".agents/", ".claude/settings.local.json"] : IGNORED).filter((l) => !lines.includes(l));
	if (missing.length) {
		mkdirSync(dirname(ignoreFile), { recursive: true });
		appendFileSync(ignoreFile, `${lines.length && lines.at(-1) !== "" ? "\n" : ""}# harness: local evidence and the per-change contract\n${missing.join("\n")}\n`);
		done.push(`ignored ${missing.join(", ")}`);
	}
	return { root, done };
}

function check(repo) {
	const root = git(repo, "rev-parse", "--show-toplevel").stdout.trim();
	const problems = [];
	const settings = { ...readJson(join(root, ".claude", "settings.json")), ...readJson(join(root, ".claude", "settings.local.json")) };
	for (const id of plugins()) if (settings.enabledPlugins?.[id] !== true) problems.push(`plugin ${id} is not enabled`);
	for (const f of ["harness.md", "routing.md", "verify/doctor.sh", "verify/check.sh", "verify/fresh.sh", "verify/observe.sh"]) {
		if (!existsSync(join(root, ".agents", f))) problems.push(`.agents/${f} is missing`);
	}
	if (existsSync(SCAFFOLD) && existsSync(join(root, ".agents", "verify"))) {
		const r = spawnSync(process.execPath, [SCAFFOLD, root, "--check"], { encoding: "utf8" });
		if (r.status !== 0) problems.push(`verify kit differs from Railly's: ${(r.stderr || r.stdout).trim()}`);
	}
	const stub = join(root, ".agents", "verify", "check.sh");
	if (existsSync(stub) && readFileSync(stub, "utf8").includes("no checks configured")) problems.push(".agents/verify/check.sh is still the stub");
	return problems;
}

function main() {
	const [cmd, ...rest] = process.argv.slice(2);
	const repo = resolve(rest.find((a) => !a.startsWith("--")) ?? ".");
	const opts = { design: rest.includes("--design"), maintainer: rest.includes("--maintainer"), local: rest.includes("--local") };
	if (cmd === "init") {
		const { root, done } = init(repo, opts);
		console.log(done.length ? done.map((d) => `  ${d}`).join("\n") : "  nothing to do");
		console.log(`\n${root} is harnessed. Next, in a session there:`);
		console.log("  1. fill .agents/verify/doctor.sh and check.sh, then the drivers (Skill: verify-setup)");
		console.log("  2. fill .agents/harness.md and .agents/routing.md with what is true only here");
		console.log("  3. harness check");
		return;
	}
	if (cmd === "check") {
		const problems = check(repo);
		for (const p of problems) console.log(`  ✖ ${p}`);
		console.log(problems.length ? `\n${problems.length} problem(s)` : "  ✔ harnessed");
		process.exit(problems.length ? 1 : 0);
	}
	console.error("usage: harness init [repo] [--design] [--maintainer] [--local] | harness check [repo]");
	process.exit(2);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
