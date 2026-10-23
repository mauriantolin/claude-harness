#!/usr/bin/env node
// Checks the machine: are Railly's skills installed and identical to the
// remote, is nothing of the harness global anymore, and do the hooks and
// skill dependencies resolve? In a harnessed repository it also runs
// `harness check`. validate-skills.mjs covers this repository's own content.
//
//   node scripts/doctor.mjs
//
// Exit 1 on any error. Warnings are printed and do not fail.

import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverSkills, parseFrontmatter, skillTools } from "./lib/skills.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
const PLUGINS = join(CLAUDE_DIR, "plugins");
// Railly folded its "candidates" channel into stable and experimental.
const RAILLY_PLUGINS = ["stable@railly-skills", "experimental@railly-skills"];
const IS_WINDOWS = process.platform === "win32";

const skills = discoverSkills(REPO);
const errors = [];
const warnings = [];
const ok = (m) => console.log(`  ✔ ${m}`);
const err = (m) => {
	errors.push(m);
	console.log(`  ✖ ${m}`);
};
const warn = (m) => {
	warnings.push(m);
	console.log(`  ! ${m}`);
};
const section = (t) => console.log(`\n${t}`);

function run(cmd, args) {
	const opts = { encoding: "utf8", timeout: 20000 };
	return IS_WINDOWS ? spawnSync([cmd, ...args].join(" "), [], { ...opts, shell: true }) : spawnSync(cmd, args, opts);
}

// bun links its tools into ~/.bun/bin, which an interactive shell has on PATH
// and a hook or script often does not.
function which(cmd, args = ["--version"]) {
	for (const candidate of [cmd, join(homedir(), ".bun", "bin", cmd)]) {
		const r = run(candidate, args);
		if (!r.error && r.status === 0) return (r.stdout || r.stderr || "").trim().split(/\r?\n/)[0];
	}
	return null;
}

function readJson(file) {
	try {
		return JSON.parse(readFileSync(file, "utf8"));
	} catch {
		return null;
	}
}

const samePath = (a, b) => {
	try {
		const norm = (p) => realpathSync(p).replace(/\\/g, "/").toLowerCase();
		return norm(a) === norm(b);
	} catch {
		return false;
	}
};

function findFiles(dir, name, acc = []) {
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return acc;
	}
	for (const e of entries) {
		const p = join(dir, e.name);
		if (e.isDirectory()) {
			if (e.name !== ".git" && e.name !== "node_modules") findFiles(p, name, acc);
		} else if (e.name === name) acc.push(p);
	}
	return acc;
}

// ---------------------------------------------------------------- binaries

section("binaries");
const major = Number(process.versions.node.split(".")[0]);
if (major >= 20) ok(`node ${process.versions.node}`);
else err(`node ${process.versions.node}; 20 or newer is required`);

const claudeVersion = which("claude");
if (claudeVersion) ok(`claude ${claudeVersion}`);
else err("claude is not on PATH; nothing here can run evals without it");

for (const [cmd, why, args] of [
	["gh", "deploy-gate and Railly's loop need an authenticated gh"],
	["bun", "Railly's validate-skills and skills-doctor run on bun"],
	["agent-browser", "verify kit web drivers observe pages with it", ["--help"]],
]) {
	const v = which(cmd, args);
	if (v) ok(`${cmd} ${v}`);
	else warn(`${cmd} not found: ${why}`);
}
if (which("gh")) {
	const auth = run("gh", ["auth", "status"]);
	if (auth.status === 0) ok("gh is authenticated");
	else warn("gh is not authenticated");
}

// ----------------------------------------------------------------- plugins

section("plugins (installed on the machine, enabled by each repository)");
const settings = readJson(join(CLAUDE_DIR, "settings.json")) ?? {};
const enabled = settings.enabledPlugins ?? {};
const installed = readJson(join(PLUGINS, "installed_plugins.json"))?.plugins ?? {};
for (const id of RAILLY_PLUGINS) {
	if (!installed[id]) err(`${id} is not installed`);
	else ok(`${id} installed`);
}
for (const [id, on] of Object.entries(enabled)) {
	if (on === true) warn(`${id} is enabled globally: its skills compete in every repository; enable it in the repositories that use it`);
}

const clone = ["railly-skills", "Railly-skills"].map((n) => join(PLUGINS, "marketplaces", n)).find((p) => existsSync(p));
if (!clone) err("the railly-skills marketplace clone is missing");
else {
	const status = spawnSync("git", ["status", "--porcelain"], { cwd: clone, encoding: "utf8" });
	if (status.status !== 0) warn("could not read the clone's git status");
	else if (status.stdout.trim()) err(`the railly-skills clone has local modifications:\n${status.stdout.trimEnd()}`);
	else ok("railly-skills clone is clean");
	const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: clone, encoding: "utf8" }).stdout.trim();
	// Claude Code clones marketplaces shallow; gate's own test-report-gate.sh needs HEAD~1 and
	// fails there, while it passes on a full clone of the same revision.
	if (spawnSync("git", ["rev-parse", "--is-shallow-repository"], { cwd: clone, encoding: "utf8" }).stdout.trim() === "true")
		warn("the railly-skills clone is shallow: run Railly's own gate tests on a full clone (git clone https://github.com/Railly/skills)");
	const remote = spawnSync("git", ["ls-remote", "https://github.com/Railly/skills.git", "HEAD"], { encoding: "utf8", timeout: 20_000 });
	const remoteHead = remote.stdout.split(/\s/)[0];
	if (!remoteHead) warn("could not read Railly's remote HEAD");
	else if (remoteHead !== head) err(`railly-skills clone is at ${head.slice(0, 7)}, remote is ${remoteHead.slice(0, 7)}: claude plugin marketplace update railly-skills`);
	else ok(`railly-skills is at the remote HEAD (${head.slice(0, 7)})`);
	const cached = Object.values(installed).flat().filter((i) => i.installPath?.includes("railly-skills"));
	for (const inst of cached) if (!inst.installPath.endsWith(head.slice(0, 12))) err(`installed Railly plugin ${inst.installPath} is not the clone's HEAD: claude plugin update`);
}

// ------------------------------------------------------- nothing global

// The harness lives in each repository. Anything of it still under the user
// directory is visible in every repository and competes with their own.
section("global (context only: no harness skills, scripts or hooks)");
const pointsHere = (entry) => {
	try {
		return lstatSync(entry).isSymbolicLink() ? realpathSync(entry).startsWith(REPO) : readFileSync(entry, "utf8").includes("claude-harness:launcher");
	} catch {
		return false;
	}
};
let globalHarness = 0;
for (const d of ["skills", "scripts", "hooks"]) {
	const dir = join(CLAUDE_DIR, d);
	if (!existsSync(dir)) continue;
	for (const name of readdirSync(dir)) if (pointsHere(join(dir, name)) && ++globalHarness) err(`~/.claude/${d}/${name} still points at this working copy: ./install.sh removes it`);
}
const hookCommands = Object.values(settings.hooks ?? {}).flat().flatMap((g) => g.hooks ?? []).map((h) => h.command ?? "");
for (const name of Object.keys(JSON.parse(readFileSync(join(REPO, "hooks", "events.json"), "utf8")))) {
	if (hookCommands.some((c) => c.includes(`/hooks/${name}.`))) err(`hook ${name} is registered globally: node machine/settings.mjs removes it`);
}
// `synced` is where Claude Code keeps skills synced from claude.ai; not ours.
const globalSkills = existsSync(join(CLAUDE_DIR, "skills")) ? readdirSync(join(CLAUDE_DIR, "skills")).filter((n) => n !== "synced") : [];
if (globalSkills.length) warn(`${globalSkills.length} global skill(s) in ~/.claude/skills are visible in every repository: ${globalSkills.join(", ")}`);
else if (!globalHarness) ok("no global skills");

// ------------------------------------------------------------------- hooks

section("hooks (served by the harness plugin from hooks/core.json)");
const built = spawnSync(process.execPath, [join(REPO, "scripts", "build-hooks.mjs"), "--check"], { encoding: "utf8" });
if (built.status === 0) ok("hooks/core.json matches hooks/events.json");
else err(built.stderr.trim());
for (const name of Object.keys(JSON.parse(readFileSync(join(REPO, "hooks", "events.json"), "utf8")))) {
	if (["mjs", "sh"].some((ext) => existsSync(join(REPO, "hooks", name, `hook.${ext}`)))) ok(`${name}`);
	else err(`hooks/events.json lists ${name}, which has no hook.mjs or hook.sh`);
}

// ------------------------------------------------------ skill dependencies

section("skill dependencies (allowed-tools Skill(...))");

// Dependencies Railly's own text declares optional: their absence is a
// capability the loop runs without, not a broken install. Everything else
// that is missing is an error, because a delegate that does not exist gets
// re-invented by the agent, which is exactly what the skills forbid.
const OPTIONAL_DEPS = {
	herdr: "optional runtime adapter; Railly's gate falls back to a native subagent without it",
};

function railllyPluginRoots() {
	const roots = [];
	for (const id of RAILLY_PLUGINS) {
		for (const inst of installed[id] ?? []) if (inst.installPath && existsSync(inst.installPath)) roots.push(inst.installPath);
	}
	return roots;
}
function pluginSkillRoots(pluginName) {
	const roots = [];
	for (const [id, insts] of Object.entries(installed)) {
		if (!id.startsWith(`${pluginName}@`) || enabled[id] !== true) continue;
		for (const inst of insts) if (inst.installPath && existsSync(inst.installPath)) roots.push(inst.installPath);
	}
	return roots;
}
function resolveSkill(ref) {
	const [plugin, name] = ref.includes(":") ? ref.split(":") : [null, ref];
	if (plugin) return pluginSkillRoots(plugin).some((r) => existsSync(join(r, "skills", name)));
	if (existsSync(join(CLAUDE_DIR, "skills", name))) return true;
	return railllyPluginRoots().some(
		(r) => existsSync(join(r, "skills", name)) || existsSync(join(r, "skills", ".experimental", name)),
	);
}

// Every installed Railly skill and every skill here: a delegate that does
// not exist gets re-invented by the agent.
const railllySkillMds = railllyPluginRoots().flatMap((r) => findFiles(join(r, "skills"), "SKILL.md"));
const seen = new Set();
const toCheck = [
	...railllySkillMds.map((f) => ({ name: basename(dirname(f)), file: f })).filter((s) => !seen.has(s.name) && seen.add(s.name)),
	...skills.map((s) => ({ name: s.name, file: join(s.root, "SKILL.md") })),
];
for (const name of ["contract", "verify-setup", "loop", "gate", "correct"]) if (!seen.has(name)) err(`Railly's ${name} SKILL.md not found in the installed railly-skills plugins`);
for (const { name, file } of toCheck) {
	const fm = parseFrontmatter(readFileSync(file, "utf8"));
	for (const dep of skillTools(fm)) {
		if (resolveSkill(dep)) ok(`${name} → ${dep}`);
		else if (["dataviz", "artifact-design", "artifact-diagramming", "artifact-capabilities"].includes(dep)) {
			ok(`${name} → ${dep} (built into Claude Code, not on disk)`);
		} else if (OPTIONAL_DEPS[dep]) {
			warn(`${name} → ${dep} is not installed (${OPTIONAL_DEPS[dep]})`);
		} else err(`${name} needs Skill(${dep}) and it is not installed`);
	}
}

// ------------------------------------------------------------- source root

section("this repository (harness check)");
if (!existsSync(join(process.cwd(), ".agents"))) console.log("  – the current directory is not a harnessed repository (harness init)");
else {
	const r = spawnSync(process.execPath, [join(REPO, "bin", "harness.mjs"), "check", process.cwd()], { encoding: "utf8" });
	for (const line of r.stdout.trim().split("\n")) console.log(line);
	if (r.status !== 0) err("harness check failed");
}

// ----------------------------------------------------------------- verdict

console.log("");
if (errors.length) {
	console.log(`${errors.length} error(s), ${warnings.length} warning(s)`);
	process.exit(1);
}
console.log(`healthy (${warnings.length} warning(s))`);
