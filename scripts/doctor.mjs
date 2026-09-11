#!/usr/bin/env node
// Checks the machine, not the repository: is everything factory-loop needs
// installed, linked, enabled and unmodified? validate-skills.mjs covers the
// repository's own content.
//
//   node scripts/doctor.mjs
//
// Exit 1 on any error. Warnings are printed and do not fail.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverSkills, parseFrontmatter, skillTools } from "./lib/skills.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
const PLUGINS = join(CLAUDE_DIR, "plugins");
const RAILLY_PLUGINS = ["stable@railly-skills", "candidates@railly-skills", "experimental@railly-skills"];
const IS_WINDOWS = process.platform === "win32";

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
	["gh", "ship, deploy-gate and xref need an authenticated gh"],
	["bun", "before-after and xref run on bun"],
	["xref", "Gate 1 degrades to gh search without it", ["--help"]],
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

section("plugins");
const settings = readJson(join(CLAUDE_DIR, "settings.json")) ?? {};
const enabled = settings.enabledPlugins ?? {};
const installed = readJson(join(PLUGINS, "installed_plugins.json"))?.plugins ?? {};
for (const id of RAILLY_PLUGINS) {
	if (!installed[id]) err(`${id} is not installed`);
	else if (enabled[id] !== true) err(`${id} is installed but not enabled`);
	else ok(`${id} enabled`);
}
if (enabled["superpowers@superpowers-dev"] === true) {
	warn("superpowers is enabled: it forces its own process skills on every message and competes with factory-loop");
}
if (enabled["skill-creator@claude-plugins-official"] !== true) {
	warn("skill-creator is not enabled: its evals.json and grading.json shapes are the ones this harness reads");
}

const clone = ["railly-skills", "Railly-skills"].map((n) => join(PLUGINS, "marketplaces", n)).find((p) => existsSync(p));
if (!clone) err("the railly-skills marketplace clone is missing");
else {
	const status = spawnSync("git", ["status", "--porcelain"], { cwd: clone, encoding: "utf8" });
	if (status.status !== 0) warn("could not read the clone's git status");
	else if (status.stdout.trim()) err(`the railly-skills clone has local modifications:\n${status.stdout.trimEnd()}`);
	else ok("railly-skills clone is clean");
}
const patched = findFiles(PLUGINS, "resolve-source-root.mjs").filter((f) => readFileSync(f, "utf8").includes("[in-repo-patch]"));
if (patched.length) err(`${patched.length} copy(ies) of resolve-source-root.mjs still carry the retired in-repo patch`);
else ok("no patched resolve-source-root.mjs copies; RAILLY_SKILLS_REPO is the only redirection");

// ------------------------------------------------------------------- links

section("links into ~/.claude");
const skills = discoverSkills(REPO);
for (const skill of skills) {
	const dest = join(CLAUDE_DIR, "skills", skill.name);
	if (!existsSync(dest)) err(`${skill.name} is not linked (run ./install.sh)`);
	else if (!samePath(dest, skill.root)) err(`${skill.name} in ~/.claude/skills is not this repository's copy`);
	else ok(`${skill.name} → ${skill.catalog}`);
}
for (const script of readdirSync(join(REPO, "scripts")).filter((f) => f.endsWith(".mjs"))) {
	const dest = join(CLAUDE_DIR, "scripts", script);
	if (!existsSync(dest)) err(`scripts/${script} has no launcher in ~/.claude/scripts (run ./install.sh)`);
	else {
		const text = readFileSync(dest, "utf8");
		if (!text.includes("claude-harness:launcher")) err(`~/.claude/scripts/${script} is not a launcher this repository generated`);
		else if (!text.includes(basename(REPO))) warn(`~/.claude/scripts/${script} points somewhere other than ${REPO}`);
		else ok(`scripts/${script} launcher`);
	}
}

// ------------------------------------------------------------------- hooks

// A hook under hooks/<name>/ is live only when its launcher exists AND
// settings.json runs it on the event it was written for. install.sh does the
// first; the second is a manual edit, so this is the only place that notices
// it was never made or was later removed.
section("hooks (hooks/*/hook.mjs registered in ~/.claude/settings.json)");
const HOOK_EVENTS = { "factory-loop-checkpoints": { event: "PostToolUse", matcher: "Skill" } };
const hooksDir = join(REPO, "hooks");
const hookNames = existsSync(hooksDir)
	? readdirSync(hooksDir, { withFileTypes: true })
			.filter((d) => d.isDirectory() && existsSync(join(hooksDir, d.name, "hook.mjs")))
			.map((d) => d.name)
	: [];
for (const name of hookNames) {
	const launcher = join(CLAUDE_DIR, "hooks", `${name}.mjs`);
	if (!existsSync(launcher)) {
		err(`hooks/${name} has no launcher in ~/.claude/hooks (run ./install.sh)`);
		continue;
	}
	if (!readFileSync(launcher, "utf8").includes("claude-harness:launcher")) {
		err(`~/.claude/hooks/${name}.mjs is not a launcher this repository generated`);
		continue;
	}
	const want = HOOK_EVENTS[name];
	if (!want) {
		warn(`hooks/${name}: no event declared in doctor.mjs, cannot check registration`);
		continue;
	}
	const groups = settings.hooks?.[want.event] ?? [];
	const registered = groups.some(
		(g) =>
			(g.matcher ?? "").split("|").includes(want.matcher) &&
			(g.hooks ?? []).some((h) => h.type === "command" && typeof h.command === "string" && h.command.replace(/\\\\/g, "\\").includes(`${name}.mjs`)),
	);
	if (registered) ok(`${name} → ${want.event}(${want.matcher})`);
	else err(`${name} is linked but not registered: add a ${want.event} hook with matcher "${want.matcher}" running ~/.claude/hooks/${name}.mjs`);
}

// ------------------------------------------------------ skill dependencies

section("skill dependencies (allowed-tools Skill(...))");

// Dependencies Railly's own text declares optional: their absence is a
// capability the loop runs without, not a broken install. Everything else
// that is missing is an error, because a delegate that does not exist gets
// re-invented by the agent, which is exactly what the skills forbid.
const OPTIONAL_DEPS = {
	herdr: "optional runtime adapter; factory-loop and solution-gate run without Herdr",
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

// Every installed Railly skill, not only the orchestrators: solution-gate
// delegates to an external `shaping` skill, and a dependency two hops down
// is still a dependency factory-loop cannot run without.
const railllySkillMds = railllyPluginRoots().flatMap((r) => findFiles(join(r, "skills"), "SKILL.md"));
const seen = new Set();
const toCheck = [
	...railllySkillMds.map((f) => ({ name: basename(dirname(f)), file: f })).filter((s) => !seen.has(s.name) && seen.add(s.name)),
	...skills.map((s) => ({ name: s.name, file: join(s.root, "SKILL.md") })),
];
if (!seen.has("factory-loop")) err("factory-loop SKILL.md not found in the installed railly-skills plugins");
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

section("in-repo knowledge (RAILLY_SKILLS_REPO)");
const local = readJson(join(process.cwd(), ".claude", "settings.local.json"));
const target = local?.env?.RAILLY_SKILLS_REPO;
if (!target) {
	console.log("  – no .claude/settings.local.json with RAILLY_SKILLS_REPO in the current directory (scaffold with railly-inrepo.mjs)");
} else if (clone) {
	const r = spawnSync(process.execPath, [join(clone, "scripts", "resolve-source-root.mjs")], {
		encoding: "utf8",
		env: { ...process.env, RAILLY_SKILLS_REPO: target },
	});
	if (r.status === 0) ok(`resolves to ${r.stdout.trim()}`);
	else err(`RAILLY_SKILLS_REPO=${target} does not resolve: ${r.stderr.trim()}`);
}

// ----------------------------------------------------------------- verdict

console.log("");
if (errors.length) {
	console.log(`${errors.length} error(s), ${warnings.length} warning(s)`);
	process.exit(1);
}
console.log(`healthy (${warnings.length} warning(s))`);
