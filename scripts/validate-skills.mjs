#!/usr/bin/env node
// Deterministic checks over the repository's own content. Runs without the
// network, without `claude`, and without a model: everything here is a fact
// about files. Environment checks (links, plugins, binaries) live in doctor.mjs.
//
//   node scripts/validate-skills.mjs
//
// Exit 1 with one line per defect, or 0 with a summary.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateEvalSuite, validateTriggers } from "./lib/evals.mjs";
import { CATALOGS, discoverSkills, readFrontmatter } from "./lib/skills.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MATURITY_STATES = new Set(["experimental", "dogfooded", "evaluated", "validated", "deprecated"]);
const CHANNEL_FOR_CATALOG = { stable: ["stable"], experimental: ["candidate", "experimental"] };
const CASE_FIELDS = [
	"Status",
	"Validation",
	"Human review",
	"Maintainer acceptance",
	"Delivery",
	"Visibility",
	"Repository",
	"Source",
	"Upstream status checked",
];

const errors = [];
const rel = (p) => relative(REPO, p).replace(/\\/g, "/");
const fail = (file, message) => errors.push(`${rel(file)}: ${message}`);

function readJson(file) {
	try {
		return JSON.parse(readFileSync(file, "utf8"));
	} catch (e) {
		fail(file, `invalid JSON (${e.message})`);
		return null;
	}
}

function markdownFiles(root) {
	if (!existsSync(root)) return [];
	return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
		const path = join(root, entry.name);
		if (entry.isDirectory()) return markdownFiles(path);
		return entry.name.endsWith(".md") ? [path] : [];
	});
}

function checkLinks(file) {
	const text = readFileSync(file, "utf8");
	for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
		const target = m[1];
		if (/^(https?:|mailto:|#)/.test(target)) continue;
		if (!existsSync(resolve(dirname(file), target.split("#")[0]))) {
			fail(file, `missing linked file "${target}"`);
		}
	}
}

// A scaffold leaves TODO markers on purpose, so a skill cannot pass validation
// until someone actually authored it.
function checkPlaceholders(file, text) {
	if (/\bTODO\b/.test(text)) fail(file, "placeholder TODO left in place");
}

function checkSkill(skill) {
	const skillMd = join(skill.root, "SKILL.md");
	const fm = readFrontmatter(skill.root);
	if (!fm) return fail(skillMd, "no frontmatter block");
	if (fm.name !== skill.name) fail(skillMd, `frontmatter name "${fm.name}" does not match directory "${skill.name}"`);
	if (!fm.description) fail(skillMd, "frontmatter description is missing");
	checkPlaceholders(skillMd, `${fm.description ?? ""}`);
	for (const md of [skillMd, ...markdownFiles(join(skill.root, "references"))]) checkLinks(md);

	const evalsDir = join(skill.root, "evals");
	const fixturesDir = join(evalsDir, "fixtures");
	const fixtures = existsSync(fixturesDir)
		? readdirSync(fixturesDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
		: [];
	for (const f of fixtures) {
		if (!existsSync(join(fixturesDir, f, "base"))) fail(join(fixturesDir, f), "fixture has no base/");
	}

	const evalsFile = join(evalsDir, "evals.json");
	if (existsSync(evalsFile)) {
		const suite = readJson(evalsFile);
		if (suite) {
			for (const e of validateEvalSuite(suite, skill.name, { fixtures })) fail(evalsFile, e);
			checkPlaceholders(evalsFile, JSON.stringify(suite));
		}
	} else if (skill.catalog === "stable") {
		fail(skill.root, "stable skill has no evals/evals.json");
	}

	const triggersFile = join(evalsDir, "triggers.json");
	if (existsSync(triggersFile)) {
		const triggers = readJson(triggersFile);
		if (triggers) {
			for (const e of validateTriggers(triggers)) fail(triggersFile, e);
			checkPlaceholders(triggersFile, JSON.stringify(triggers));
		}
	} else if (skill.catalog === "stable") {
		fail(skill.root, "stable skill has no evals/triggers.json");
	}
}

function checkMaturity(skills) {
	const file = join(REPO, "foundry", "maturity.json");
	if (!existsSync(file)) return fail(file, "missing");
	const registry = readJson(file);
	if (!registry?.skills) return fail(file, "has no skills map");
	for (const skill of skills) {
		const entry = registry.skills[skill.name];
		if (!entry) {
			fail(file, `no entry for ${skill.name}`);
			continue;
		}
		if (!MATURITY_STATES.has(entry.maturity)) fail(file, `${skill.name}: unknown maturity "${entry.maturity}"`);
		if (!CHANNEL_FOR_CATALOG[skill.catalog].includes(entry.channel)) {
			fail(file, `${skill.name}: channel "${entry.channel}" does not match its ${skill.catalog} location`);
		}
		if (!entry.summary) fail(file, `${skill.name}: summary is missing`);
		if (entry.decision && !existsSync(resolve(dirname(file), entry.decision))) {
			fail(file, `${skill.name}: decision "${entry.decision}" does not exist`);
		}
	}
	for (const name of Object.keys(registry.skills)) {
		if (!skills.some((s) => s.name === name)) fail(file, `entry "${name}" has no skill directory`);
	}
}

// The marketplace is the installable surface. Each catalog maps to exactly one
// plugin listing exactly its skills, so nothing ships unlisted or unbuilt.
function checkMarketplace(skills) {
	const file = join(REPO, ".claude-plugin", "marketplace.json");
	if (!existsSync(file)) return fail(file, "missing");
	const manifest = readJson(file);
	if (!Array.isArray(manifest?.plugins)) return fail(file, "has no plugins list");
	for (const { catalog, dir } of CATALOGS) {
		const expected = skills
			.filter((s) => s.catalog === catalog)
			.map((s) => `./${dir.replace(/\\/g, "/")}/${s.name}`)
			.sort();
		const plugin = manifest.plugins.find((p) => p.name === catalog);
		if (!plugin) {
			if (expected.length) fail(file, `no "${catalog}" plugin, but ${expected.length} ${catalog} skill(s) exist`);
			continue;
		}
		const listed = [...(plugin.skills ?? [])].sort();
		for (const p of expected) if (!listed.includes(p)) fail(file, `"${catalog}" plugin does not list ${p}`);
		for (const p of listed) if (!expected.includes(p)) fail(file, `"${catalog}" plugin lists ${p}, which is not a ${catalog} skill`);
	}
}

function checkCases() {
	for (const file of markdownFiles(join(REPO, "cases"))) {
		if (file.endsWith("conventions.md") || file.endsWith("README.md")) continue;
		const text = readFileSync(file, "utf8");
		for (const field of CASE_FIELDS) {
			if (!new RegExp(`^${field}:\\s+.+$`, "m").test(text)) fail(file, `missing case field "${field}"`);
		}
		if (/\/Users\/|C:\\\\Users\\\\/.test(text)) fail(file, "contains a local absolute path");
		checkLinks(file);
	}
}

const skills = discoverSkills(REPO);
if (skills.length === 0) errors.push("no skills found under skills/");
for (const skill of skills) checkSkill(skill);
checkMaturity(skills);
checkMarketplace(skills);
checkCases();

if (errors.length) {
	for (const e of errors) console.error(`✖ ${e}`);
	console.error(`\n${errors.length} problem(s)`);
	process.exit(1);
}
const stable = skills.filter((s) => s.catalog === "stable").length;
console.log(`✔ ${skills.length} skill(s) valid (${stable} stable, ${skills.length - stable} experimental)`);
