// Skill discovery and SKILL.md frontmatter, shared by every script.
//
// Layout mirrors Railly Skills: `skills/<name>` is the stable catalog and
// `skills/.experimental/<name>` holds candidates. A directory is a skill only
// when it carries a SKILL.md.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const CATALOGS = [
	{ catalog: "stable", dir: "skills" },
	{ catalog: "experimental", dir: join("skills", ".experimental") },
];

export function discoverSkills(repoRoot) {
	const found = [];
	for (const { catalog, dir } of CATALOGS) {
		const container = join(repoRoot, dir);
		if (!existsSync(container)) continue;
		for (const entry of readdirSync(container, { withFileTypes: true })) {
			if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
			const root = join(container, entry.name);
			if (existsSync(join(root, "SKILL.md"))) found.push({ name: entry.name, root, catalog });
		}
	}
	return found;
}

export function skillDir(repoRoot, name) {
	return discoverSkills(repoRoot).find((s) => s.name === name)?.root ?? null;
}

// A deliberately small YAML reader: `key: value`, quoted scalars, and block
// lists. That is the whole vocabulary SKILL.md frontmatter uses; a real YAML
// dependency would be the only dependency in the repository.
export function parseFrontmatter(text) {
	const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
	if (!match) return null;
	const out = {};
	let listKey = null;
	for (const raw of match[1].split(/\r?\n/)) {
		const item = raw.match(/^\s+-\s+(.*)$/);
		if (item && listKey) {
			out[listKey].push(unquote(item[1]));
			continue;
		}
		const pair = raw.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
		if (!pair) continue;
		const [, key, value] = pair;
		if (value === "") {
			out[key] = [];
			listKey = key;
		} else {
			out[key] = unquote(value);
			listKey = null;
		}
	}
	return out;
}

function unquote(value) {
	const v = value.trim();
	if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
		return v.slice(1, -1).replace(/\\"/g, '"');
	}
	if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
	return v;
}

export function readFrontmatter(skillRoot) {
	return parseFrontmatter(readFileSync(join(skillRoot, "SKILL.md"), "utf8"));
}

// The `Skill(name)` entries of allowed-tools are the skill's declared
// dependencies; everything else there is a tool.
export function skillTools(frontmatter) {
	const tools = frontmatter?.["allowed-tools"];
	if (!Array.isArray(tools)) return [];
	return tools.map((t) => t.match(/^Skill\((.+)\)$/)?.[1]).filter(Boolean);
}
