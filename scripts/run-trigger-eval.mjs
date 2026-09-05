#!/usr/bin/env node
// Trigger eval: does the skill load when it should, and stay out when it
// should not? Each query in evals/triggers.json is sent to a headless session
// from an empty directory, and the stream is read for Skill invocations.
//
//   node scripts/run-trigger-eval.mjs <skill> [options]
//
//     --model <model>     agent model      (default: haiku; triggering is cheap to test)
//     --parallel <n>      runs in flight   (default: 3)
//     --max-turns <n>     turns per query  (default: 4; room to look around and then decide)
//     --threshold <0..1>  exit 1 below it  (default: 0.8)
//     --out <dir>         workspace        (default: foundry/runs/triggers/<skill>/<stamp>)
//
// The skill must be installed where `claude` finds it (./install.sh). A skill
// that is not installed cannot trigger, and every positive case will fail.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runClaude, runWithLimit } from "./lib/claude-cli.mjs";
import { skillDir } from "./lib/skills.mjs";
import { isCompleteRun, judgeTrigger, skillInvocations } from "./lib/trigger-detect.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
	const opts = { skill: null, model: "haiku", parallel: 3, maxTurns: 4, threshold: 0.8, out: null };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--model") opts.model = argv[++i];
		else if (a === "--parallel") opts.parallel = Number(argv[++i]) || 1;
		else if (a === "--max-turns") opts.maxTurns = Number(argv[++i]) || 2;
		else if (a === "--threshold") opts.threshold = Number(argv[++i]);
		else if (a === "--out") opts.out = argv[++i];
		else if (!opts.skill && !a.startsWith("--")) opts.skill = a;
		else {
			console.error(`unknown argument ${a}`);
			process.exit(1);
		}
	}
	return opts;
}

async function main() {
	const opts = parseArgs(process.argv.slice(2));
	if (!opts.skill) {
		console.error("usage: node scripts/run-trigger-eval.mjs <skill> [--model m] [--parallel n] [--max-turns n] [--threshold t] [--out d]");
		process.exit(1);
	}
	const root = skillDir(REPO, opts.skill);
	if (!root) {
		console.error(`no skill named "${opts.skill}"`);
		process.exit(1);
	}
	const triggers = JSON.parse(readFileSync(join(root, "evals", "triggers.json"), "utf8"));
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	const workspace = opts.out ? resolve(opts.out) : join(REPO, "foundry", "runs", "triggers", opts.skill, stamp);
	// A minimal repository outside every project: the only skills visible are
	// the user-level ones, which is exactly what a trigger eval measures. It is
	// a repository, not an empty directory, so a query about "this change" or
	// "this branch" is not derailed into asking what project this is.
	mkdirSync(join(workspace, "stream"), { recursive: true });
	const cwd = mkdtempSync(join(tmpdir(), `harness-trigger-${opts.skill}-`));
	writeFileSync(join(cwd, "README.md"), "# scratch\n\nA small project used to test skill triggering.\n");
	const git = (...a) => execFileSync("git", a, { cwd, stdio: "pipe" });
	git("init", "-q", "-b", "main");
	git("config", "user.name", "Skill Eval");
	git("config", "user.email", "eval@example.invalid");
	git("config", "commit.gpgsign", "false");
	git("add", ".");
	git("commit", "-qm", "scratch");

	console.log(`skill      ${opts.skill}`);
	console.log(`queries    ${triggers.length} (parallel ${opts.parallel}, model ${opts.model})`);
	console.log(`workspace  ${workspace}\n`);

	const tasks = triggers.map((t, i) => async () => {
		const r = await runClaude({
			prompt: t.query,
			args: [
				"--output-format",
				"stream-json",
				"--verbose",
				"--max-turns",
				String(opts.maxTurns),
				"--model",
				opts.model,
				"--disallowed-tools",
				"Bash,Write,Edit,NotebookEdit",
			],
			cwd,
			timeoutMs: 5 * 60 * 1000,
		});
		// Running out of turns is a normal end for a trigger probe: the decision
		// to load a skill happens early, and the stream still says whether it did.
		const stream = r.stdout ?? "";
		const usable = r.ok || isCompleteRun(stream);
		writeFileSync(join(workspace, "stream", `${String(i + 1).padStart(2, "0")}.jsonl`), usable ? stream : r.text);
		const invoked = usable ? skillInvocations(stream) : [];
		const triggered = judgeTrigger(invoked, opts.skill);
		const match = usable && triggered === t.should_trigger;
		console.log(`  ${match ? "✔" : "✖"} expected ${t.should_trigger ? "trigger" : "silence"}, got ${usable ? (triggered ? "trigger" : "silence") : "RUN FAILED"}  ${t.query.slice(0, 70)}`);
		return { id: t.id, query: t.query, should_trigger: t.should_trigger, triggered, invoked, match, error: usable ? null : r.text };
	});
	const results = await runWithLimit(tasks, opts.parallel);

	const matched = results.filter((r) => r.match).length;
	const accuracy = results.length ? matched / results.length : 0;
	const falsePositives = results.filter((r) => !r.should_trigger && r.triggered).length;
	const misses = results.filter((r) => r.should_trigger && !r.triggered).length;
	const summary = { skill: opts.skill, model: opts.model, total: results.length, matched, accuracy, misses, false_positives: falsePositives, results };
	writeFileSync(join(workspace, "results.json"), `${JSON.stringify(summary, null, 2)}\n`);

	const md = [
		`# ${opts.skill} trigger eval`,
		"",
		`Model: ${opts.model}. ${matched}/${results.length} matched (${(accuracy * 100).toFixed(1)}%), ${misses} missed trigger(s), ${falsePositives} false positive(s).`,
		"",
		"| Case | Expected | Got | Query |",
		"|---|---|---|---|",
		...results.map((r) => `| ${r.id} | ${r.should_trigger ? "trigger" : "silence"} | ${r.error ? "run failed" : r.triggered ? "trigger" : "silence"} | ${r.query.replace(/\|/g, "\\|")} |`),
		"",
	].join("\n");
	writeFileSync(join(workspace, "results.md"), md);
	console.log(`\n${md}workspace: ${workspace}`);
	if (accuracy < opts.threshold) {
		console.error(`accuracy ${(accuracy * 100).toFixed(1)}% is below threshold ${(opts.threshold * 100).toFixed(0)}%`);
		process.exit(1);
	}
}

main();
