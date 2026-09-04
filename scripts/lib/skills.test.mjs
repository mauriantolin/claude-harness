import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { discoverSkills, parseFrontmatter, skillDir, skillTools } from "./skills.mjs";

function repo() {
	const root = mkdtempSync(join(tmpdir(), "harness-skills-"));
	const write = (rel, text) => {
		mkdirSync(dirname(join(root, rel)), { recursive: true });
		writeFileSync(join(root, rel), text);
	};
	write("skills/alpha/SKILL.md", '---\nname: alpha\ndescription: "A stable one"\n---\n# Alpha\n');
	write("skills/.experimental/beta/SKILL.md", "---\nname: beta\ndescription: B\n---\n");
	write("skills/.experimental/no-skill-md/README.md", "not a skill");
	write("skills/README.md", "not a skill either");
	return root;
}

test("discoverSkills finds stable and experimental skills and nothing else", () => {
	const found = discoverSkills(repo()).map((s) => [s.name, s.catalog]);
	assert.deepEqual(found, [
		["alpha", "stable"],
		["beta", "experimental"],
	]);
});

test("skillDir resolves a name in either catalog, or null", () => {
	const root = repo();
	assert.equal(skillDir(root, "alpha"), join(root, "skills", "alpha"));
	assert.equal(skillDir(root, "beta"), join(root, "skills", ".experimental", "beta"));
	assert.equal(skillDir(root, "gamma"), null);
});

test("parseFrontmatter reads scalars, quoted strings and block lists", () => {
	const fm = parseFrontmatter(`---
name: ship
description: "Turn an approved state into a PR: handles \\"quotes\\" too."
compatibility: Requires git.
allowed-tools:
  - Skill(frontend-stack)
  - Agent
---
# Body
`);
	assert.equal(fm.name, "ship");
	assert.equal(fm.description, 'Turn an approved state into a PR: handles "quotes" too.');
	assert.equal(fm.compatibility, "Requires git.");
	assert.deepEqual(fm["allowed-tools"], ["Skill(frontend-stack)", "Agent"]);
});

test("parseFrontmatter tolerates CRLF and returns null without a block", () => {
	assert.equal(parseFrontmatter("---\r\nname: x\r\n---\r\nbody").name, "x");
	assert.equal(parseFrontmatter("# no frontmatter"), null);
});

test("skillTools lists the Skill(...) dependencies declared in allowed-tools", () => {
	const fm = { "allowed-tools": ["Skill(a)", "Skill(vercel:shadcn)", "Agent", "Skill(b)"] };
	assert.deepEqual(skillTools(fm), ["a", "vercel:shadcn", "b"]);
	assert.deepEqual(skillTools({}), []);
});
