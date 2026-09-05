#!/usr/bin/env node
// Scaffolds a new skill where every new skill starts: skills/.experimental/.
//
//   node scripts/new-skill.mjs <name>
//
// The scaffold registers the skill in foundry/maturity.json and in the
// marketplace's experimental plugin, and leaves TODO markers that
// validate-skills.mjs refuses. A skill exists once it is authored, not once it
// is scaffolded.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { skillDir } from "./lib/skills.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [name] = process.argv.slice(2);

if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name)) {
	console.error("usage: node scripts/new-skill.mjs <kebab-case-name>");
	process.exit(1);
}
if (skillDir(REPO, name)) {
	console.error(`skill "${name}" already exists at ${skillDir(REPO, name)}`);
	process.exit(1);
}

const root = join(REPO, "skills", ".experimental", name);
mkdirSync(join(root, "evals", "fixtures"), { recursive: true });

writeFileSync(
	join(root, "SKILL.md"),
	`---
name: ${name}
description: "TODO: what it does, when to use it, and when NOT to use it. The description is the trigger; write it for the router, not the reader."
compatibility: TODO: what must exist for this to run, and how it degrades when something is missing.
---
# ${name}

One paragraph: the failure this skill exists to prevent, and the boundary
between this skill and its neighbours.

## 0. Decide whether this fires

State the observable signal that triggers the method and the near misses that
do not. A skip is recorded with its reason, never assumed.

**Complete when:** the trigger or the skip reason is named.

## 1. First gate

What the agent does, in order, and what evidence each step leaves behind.

**Complete when:** the evidence exists and is named.
`,
);

writeFileSync(
	join(root, "evals", "evals.json"),
	`${JSON.stringify(
		{
			skill_name: name,
			evals: [
				{
					id: 1,
					name: "TODO-observable-behavior-the-base-model-lacks",
					prompt: "TODO: a task, phrased as a user would, that exercises the method.",
					expected_output: "TODO: what a passing run looks like, as observable behavior.",
					assertions: [
						"TODO: one assertion per observable behavior; include at least one 'Does NOT ...'",
					],
					files: [],
				},
			],
		},
		null,
		2,
	)}\n`,
);

writeFileSync(
	join(root, "evals", "triggers.json"),
	`${JSON.stringify(
		[
			{ id: "positive-TODO", query: "TODO: a prompt that should load this skill", should_trigger: true },
			{ id: "negative-TODO", query: "TODO: a tempting near miss that must not load it", should_trigger: false },
		],
		null,
		2,
	)}\n`,
);

const maturityFile = join(REPO, "foundry", "maturity.json");
const maturity = JSON.parse(readFileSync(maturityFile, "utf8"));
maturity.skills[name] = {
	type: "TODO",
	channel: "experimental",
	maturity: "experimental",
	summary: "Scaffolded; no real-work use yet.",
	decision: null,
};
maturity.skills = Object.fromEntries(Object.entries(maturity.skills).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(maturityFile, `${JSON.stringify(maturity, null, 2)}\n`);

const marketplaceFile = join(REPO, ".claude-plugin", "marketplace.json");
const marketplace = JSON.parse(readFileSync(marketplaceFile, "utf8"));
let plugin = marketplace.plugins.find((p) => p.name === "experimental");
if (!plugin) {
	plugin = {
		name: "experimental",
		displayName: "Harness experimental skills",
		description: "Skills under evaluation. Installable without implying validation.",
		source: "./",
		skills: [],
	};
	marketplace.plugins.push(plugin);
}
plugin.skills = [...new Set([...(plugin.skills ?? []), `./skills/.experimental/${name}`])].sort();
writeFileSync(marketplaceFile, `${JSON.stringify(marketplace, null, 2)}\n`);

console.log(`scaffolded ${root}
registered in foundry/maturity.json and .claude-plugin/marketplace.json

next:
  1. author SKILL.md, evals/evals.json and evals/triggers.json (remove every TODO)
  2. npm run validate
  3. ./install.sh                       # links it into ~/.claude/skills
  4. npm run triggers -- ${name}        # does it load when it should, and only then?
  5. npm run eval -- ${name}            # no_skill vs current; a zero delta is a finding
  6. promote: move to skills/${name}, set channel "stable" in maturity.json, update marketplace.json`);
