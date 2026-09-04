#!/usr/bin/env node
// Re-aggregates an existing workspace of gradings into benchmark.json and
// benchmark.md. run-skill-eval.mjs already does this at the end of a run; this
// exists for a workspace assembled by hand or completed across several runs.
//
//   node scripts/aggregate-skill-eval.mjs <skill> <workspace>

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { VARIANTS, aggregate, renderBenchmark } from "./lib/evals.mjs";

const [skillName, workspaceArg] = process.argv.slice(2);
if (!skillName || !workspaceArg) {
	console.error("usage: node scripts/aggregate-skill-eval.mjs <skill> <workspace>");
	process.exit(1);
}

const workspace = resolve(workspaceArg);
const gradings = {};
for (const entry of readdirSync(workspace, { withFileTypes: true })) {
	if (!entry.isDirectory()) continue;
	for (const variant of VARIANTS) {
		const file = join(workspace, entry.name, variant, "grading.json");
		if (existsSync(file)) (gradings[entry.name] ??= {})[variant] = JSON.parse(readFileSync(file, "utf8"));
	}
}
if (!Object.keys(gradings).length) {
	console.error(`no grading.json found under ${workspace}`);
	process.exit(1);
}

const benchmark = aggregate(skillName, basename(workspace), gradings);
writeFileSync(join(workspace, "benchmark.json"), `${JSON.stringify(benchmark, null, 2)}\n`);
const md = renderBenchmark(benchmark);
writeFileSync(join(workspace, "benchmark.md"), md);
process.stdout.write(md);
