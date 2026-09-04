#!/usr/bin/env node
// The middle of the eval pipeline: runs each eval's prompt in each variant,
// grades every assertion with an independent judge, and aggregates. Railly's
// repository scaffolds workspaces and aggregates gradings but ships nothing
// that produces them; `claude plugin eval` would, but it is early-access.
//
//   node scripts/run-skill-eval.mjs <skill> [options]
//
//     --variants a,b     arms to run            (default: no_skill,current)
//     --case <name>      run one eval only
//     --out <dir>        workspace              (default: foundry/runs/evals/<skill>/<stamp>)
//     --model <model>    agent model            (default: the CLI default)
//     --judge <model>    grader model           (default: haiku)
//     --parallel <n>     runs in flight         (default: 1)
//     --candidate-dir <d> plugin dir for the candidate arm (default: this repo)
//     --dry-run          print the plan, run nothing
//     --regrade <ws>     re-run only the judge over an existing workspace, for
//                        gradings that failed (add --regrade-all for every run)
//
// Output per <eval>/<variant>/: output.txt, run.json, grading.json (and
// transcript.txt when a fixture was used). benchmark.json and benchmark.md at
// the workspace root.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runClaude, runWithLimit } from "./lib/claude-cli.mjs";
import { aggregate, renderBenchmark } from "./lib/evals.mjs";
import { skillDir } from "./lib/skills.mjs";
import { finalResult, isCompleteRun, judgeTrigger, skillInvocations } from "./lib/trigger-detect.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// This measures the method, not the trigger: the skill arms are told to load
// the skill, exactly as skill-creator hands its executor the skill path.
// Whether the skill loads unprompted is the trigger eval's question. The user
// prompt itself is identical in every arm.
const loadNudge = (ref) =>
	`The skill "${ref}" applies to this task. Load it with the Skill tool before doing anything else, then follow it.`;

// Each arm differs only in which skills the run can see. A skill that scores
// the same as `no_skill` is not earning its tokens.
const VARIANT_ARGS = {
	no_skill: () => ["--disable-slash-commands"],
	current: (_dir, skill) => ["--append-system-prompt", loadNudge(skill)],
	// A --plugin-dir skill is addressed as <plugin>:<skill>; the plugin name
	// comes from the working copy's plugin.json.
	candidate: (dir, skill) => {
		const plugin = JSON.parse(readFileSync(join(dir, ".claude-plugin", "plugin.json"), "utf8")).name;
		return ["--plugin-dir", dir, "--append-system-prompt", loadNudge(`${plugin}:${skill}`)];
	},
};

function parseArgs(argv) {
	const opts = {
		skill: null,
		variants: ["no_skill", "current"],
		caseName: null,
		out: null,
		model: null,
		judge: "haiku",
		parallel: 1,
		candidateDir: REPO,
		dryRun: false,
		regrade: null,
		regradeAll: false,
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--variants") opts.variants = argv[++i].split(",");
		else if (a === "--case") opts.caseName = argv[++i];
		else if (a === "--out") opts.out = argv[++i];
		else if (a === "--model") opts.model = argv[++i];
		else if (a === "--judge") opts.judge = argv[++i];
		else if (a === "--parallel") opts.parallel = Number(argv[++i]) || 1;
		else if (a === "--candidate-dir") opts.candidateDir = resolve(argv[++i]);
		else if (a === "--dry-run") opts.dryRun = true;
		else if (a === "--regrade") opts.regrade = resolve(argv[++i]);
		else if (a === "--regrade-all") opts.regradeAll = true;
		else if (!opts.skill && !a.startsWith("--")) opts.skill = a;
		else {
			console.error(`unknown argument ${a}`);
			process.exit(1);
		}
	}
	return opts;
}

// A fixture run has to branch, commit and write, so it gets write tools,
// bounded by cwd to a throwaway repository this script just created. A run
// without a fixture is read-only.
function agentArgs(variantArgs, model, hasFixture) {
	const args = hasFixture
		? ["--disallowed-tools", "NotebookEdit", "--dangerously-skip-permissions"]
		: ["--disallowed-tools", "Bash,Write,Edit,NotebookEdit"];
	if (model) args.push("--model", model);
	// The stream is what says whether the skill actually loaded.
	return [...args, "--output-format", "stream-json", "--verbose", ...variantArgs];
}

// The judge sees the assertions and the transcript, never the skill, and
// returns one verdict per assertion so a soft one cannot carry the others.
async function grade(item, transcript, judgeModel) {
	const prompt = `You are a grader. Another agent already ran; its complete output is quoted
below under "Transcript". You are NOT that agent, you are NOT being asked to do
its task, and you have everything you need. Never ask for more information.

For each expectation, decide whether the transcript satisfies it. You are not
grading whether the answer is good. An expectation phrased as a prohibition
("Does NOT ...") passes only when the transcript actually avoided the thing.

Absence of evidence is a failure, not a pass: if the transcript never addresses
an expectation, it did not satisfy it. A transcript that only asks questions
instead of doing the task fails every expectation about doing it.

## Task the agent was given
${item.prompt}

## Expectations
${item.assertions.map((a, i) => `${i + 1}. ${a}`).join("\n")}

## Transcript (complete; quoted verbatim)
<transcript>
${transcript}
</transcript>

## Output
Return ONLY a JSON object, no prose and no code fence:
{"expectations":[{"index":1,"assertion":"<verbatim>","passed":true|false,"reason":"<one sentence>"}]}`;

	// A judge that drifts out of role returns prose instead of JSON. One retry
	// covers that; a second failure is recorded, never guessed.
	let lastError = "";
	for (let attempt = 0; attempt < 2; attempt++) {
		const r = await runClaude({
			prompt,
			args: ["--disable-slash-commands", "--disallowed-tools", "Bash,Write,Edit,NotebookEdit", "--model", judgeModel],
		});
		if (!r.ok) {
			lastError = r.text;
			continue;
		}
		const match = r.text.match(/\{[\s\S]*\}/);
		if (!match) {
			lastError = `judge returned no JSON:\n${r.text}`;
			continue;
		}
		try {
			const parsed = JSON.parse(match[0]);
			if (Array.isArray(parsed.expectations) && parsed.expectations.length === item.assertions.length) return parsed;
			lastError = `judge returned ${parsed.expectations?.length ?? 0} verdicts for ${item.assertions.length} expectations`;
		} catch (e) {
			lastError = `judge JSON invalid: ${e.message}`;
		}
	}
	return { error: lastError, expectations: [] };
}

// Re-runs only the judge over an existing workspace, for gradings that failed
// or when the judge prompt changed. Agent runs are never repeated here.
async function regrade(workspace, opts) {
	const suite = JSON.parse(readFileSync(join(skillDir(REPO, opts.skill), "evals", "evals.json"), "utf8"));
	const tasks = [];
	for (const item of suite.evals) {
		for (const variant of ["no_skill", "current", "candidate"]) {
			const dir = join(workspace, item.name, variant);
			const gradingFile = join(dir, "grading.json");
			if (!existsSync(gradingFile)) continue;
			const old = JSON.parse(readFileSync(gradingFile, "utf8"));
			if (!opts.regradeAll && !old.error) continue;
			const runFile = join(dir, "run.json");
			const runInfo = JSON.parse(readFileSync(runFile, "utf8"));
			let skillInvoked = old.skill_invoked === true;
			// A run recorded as failed by an earlier runner may still hold a
			// complete stream (a max-turns stop); recover its answer from it.
			if (!runInfo.ok) {
				const streamFile = join(dir, "stream.jsonl");
				const stream = existsSync(streamFile) ? readFileSync(streamFile, "utf8") : "";
				if (!isCompleteRun(stream)) continue;
				const answer = finalResult(stream);
				const invocations = skillInvocations(stream);
				skillInvoked = judgeTrigger(invocations, opts.skill);
				writeFileSync(join(dir, "output.txt"), answer);
				const repo = join(dir, "repo");
				if (existsSync(repo)) {
					writeFileSync(join(dir, "transcript.txt"), `## What the agent answered\n${answer}\n\n## Repository state after the run\n${gitState(repo)}`);
				}
				writeFileSync(runFile, `${JSON.stringify({ ...runInfo, ok: true, recovered: true, skill_invoked: skillInvoked, invocations }, null, 2)}\n`);
			}
			const transcriptFile = join(dir, "transcript.txt");
			const transcript = readFileSync(existsSync(transcriptFile) ? transcriptFile : join(dir, "output.txt"), "utf8");
			tasks.push(async () => {
				const grading = { skill_invoked: skillInvoked, ...(await grade(item, transcript, opts.judge)) };
				writeFileSync(gradingFile, `${JSON.stringify(grading, null, 2)}\n`);
				const passed = (grading.expectations || []).filter((e) => e.passed).length;
				console.log(`  ${item.name} / ${variant} ... ${grading.error ? "GRADING FAILED" : `${passed}/${grading.expectations.length}`}`);
			});
		}
	}
	console.log(`regrading ${tasks.length} run(s) in ${workspace}\n`);
	await runWithLimit(tasks, opts.parallel);
}

function gitState(repo) {
	const g = (...a) => {
		try {
			return execFileSync("git", a, { cwd: repo, encoding: "utf8", stdio: "pipe" }).trim();
		} catch {
			return "(unavailable)";
		}
	};
	return [
		`branch: ${g("rev-parse", "--abbrev-ref", "HEAD")}`,
		`commits:\n${g("log", "--oneline", "--all")}`,
		`status:\n${g("status", "--short") || "(clean)"}`,
		`last commit message:\n${g("log", "-1", "--pretty=%B")}`,
	].join("\n");
}

async function runOne({ item, variant, dir, opts }) {
	mkdirSync(dir, { recursive: true });

	// Each arm gets its own copy, so one arm's commits cannot be read as
	// another arm's evidence. Without a fixture the run gets an empty directory
	// under the OS temp dir, outside every repository, so no project's settings,
	// CLAUDE.md or skills can leak into the measurement.
	let cwd;
	let repo = null;
	if (item.fixture) {
		repo = join(dir, "repo");
		execFileSync(process.execPath, [join(REPO, "scripts", "setup-eval-fixture.mjs"), opts.skill, item.fixture, repo], {
			stdio: "pipe",
		});
		cwd = repo;
	} else {
		cwd = mkdtempSync(join(tmpdir(), `harness-eval-${opts.skill}-`));
	}

	const run = await runClaude({
		prompt: item.prompt,
		args: agentArgs(VARIANT_ARGS[variant](opts.candidateDir, opts.skill), opts.model, Boolean(repo)),
		cwd,
	});
	// A session that ran out of turns still produced a transcript worth
	// grading: what the agent did before stopping is the evidence.
	const stream = run.stdout ?? "";
	const usable = run.ok || isCompleteRun(stream);
	const answer = usable ? finalResult(stream) : run.text;
	const invocations = usable ? skillInvocations(stream) : [];
	const skillInvoked = judgeTrigger(invocations, opts.skill);
	writeFileSync(join(dir, "stream.jsonl"), usable ? stream : run.text);
	writeFileSync(join(dir, "output.txt"), answer);
	writeFileSync(
		join(dir, "run.json"),
		`${JSON.stringify(
			{ variant, prompt: item.prompt, model: opts.model, judge: opts.judge, cwd, ok: usable, exit_status: run.status, skill_invoked: skillInvoked, invocations },
			null,
			2,
		)}\n`,
	);

	if (!usable) {
		const grading = {
			error: run.text,
			skill_invoked: false,
			expectations: item.assertions.map((a, i) => ({ index: i + 1, assertion: a, passed: false, reason: "run failed" })),
		};
		writeFileSync(join(dir, "grading.json"), `${JSON.stringify(grading, null, 2)}\n`);
		return { item, variant, label: "RUN FAILED", grading };
	}

	// What the agent DID outranks what it said, so the judge reads the
	// repository state alongside the answer.
	let transcript = answer;
	if (repo) {
		transcript = `## What the agent answered\n${answer}\n\n## Repository state after the run\n${gitState(repo)}`;
		writeFileSync(join(dir, "transcript.txt"), transcript);
	}

	const grading = { skill_invoked: skillInvoked, ...(await grade(item, transcript, opts.judge)) };
	writeFileSync(join(dir, "grading.json"), `${JSON.stringify(grading, null, 2)}\n`);
	const passed = (grading.expectations || []).filter((e) => e.passed).length;
	const total = grading.expectations?.length || 0;
	const loaded = variant === "no_skill" ? "" : skillInvoked ? " (skill loaded)" : " (skill NOT loaded)";
	return { item, variant, label: grading.error ? "GRADING FAILED" : `${passed}/${total}${loaded}`, grading };
}

async function main() {
	const opts = parseArgs(process.argv.slice(2));
	if (!opts.skill) {
		console.error(
			"usage: node scripts/run-skill-eval.mjs <skill> [--variants a,b] [--case n] [--out d] [--model m] [--judge m] [--parallel n] [--dry-run]",
		);
		process.exit(1);
	}
	const root = skillDir(REPO, opts.skill);
	if (!root) {
		console.error(`no skill named "${opts.skill}" under skills/ or skills/.experimental/`);
		process.exit(1);
	}
	const evalsPath = join(root, "evals", "evals.json");
	if (!existsSync(evalsPath)) {
		console.error(`${opts.skill} has no evals/evals.json`);
		process.exit(1);
	}
	if (opts.regrade) {
		await regrade(opts.regrade, opts);
		execFileSync(process.execPath, [join(REPO, "scripts", "aggregate-skill-eval.mjs"), opts.skill, opts.regrade], { stdio: "inherit" });
		return;
	}
	const suite = JSON.parse(readFileSync(evalsPath, "utf8"));
	const items = opts.caseName ? suite.evals.filter((e) => e.name === opts.caseName) : suite.evals;
	if (!items.length) {
		console.error(`no eval named "${opts.caseName}" in ${evalsPath}`);
		process.exit(1);
	}
	for (const v of opts.variants) {
		if (!VARIANT_ARGS[v]) {
			console.error(`unknown variant "${v}" (known: ${Object.keys(VARIANT_ARGS).join(", ")})`);
			process.exit(1);
		}
	}

	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	const workspace = opts.out ? resolve(opts.out) : join(REPO, "foundry", "runs", "evals", opts.skill, stamp);

	console.log(`skill      ${opts.skill}`);
	console.log(`evals      ${items.length}`);
	console.log(`variants   ${opts.variants.join(", ")}`);
	console.log(`runs       ${items.length * opts.variants.length} (parallel ${opts.parallel})`);
	console.log(`model      ${opts.model ?? "(default)"}   judge ${opts.judge}`);
	console.log(`workspace  ${workspace}\n`);

	if (opts.dryRun) {
		for (const item of items) for (const v of opts.variants) console.log(`  would run  ${item.name} / ${v}`);
		return;
	}

	const tasks = [];
	for (const item of items) {
		for (const variant of opts.variants) {
			tasks.push(async () => {
				const r = await runOne({ item, variant, dir: join(workspace, item.name, variant), opts });
				console.log(`  ${item.name} / ${variant} ... ${r.label}`);
				return r;
			});
		}
	}
	const results = await runWithLimit(tasks, opts.parallel);

	const gradings = {};
	for (const r of results) (gradings[r.item.name] ??= {})[r.variant] = r.grading;
	const benchmark = aggregate(opts.skill, stamp, gradings);
	writeFileSync(join(workspace, "benchmark.json"), `${JSON.stringify(benchmark, null, 2)}\n`);
	const md = renderBenchmark(benchmark);
	writeFileSync(join(workspace, "benchmark.md"), md);
	console.log(`\n${md}workspace: ${workspace}`);
}

main();
