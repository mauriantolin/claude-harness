#!/usr/bin/env node
// The middle of Railly's eval pipeline, which his repository does not ship.
//
// `setup-skill-eval.mjs` scaffolds variant workspaces and
// `aggregate-skill-eval.mjs` reads a `grading.json` out of each one, but nothing
// runs the prompts or writes that grading. This does, so the loop closes without
// `claude plugin eval`, which is gated behind early access.
//
//   node scripts/run-skill-eval.mjs <skill> [options]
//
//     --variants a,b   which arms to run   (default: no_skill,current)
//     --case <name>    run one eval only
//     --out <dir>      workspace           (default: skills/<skill>/evals/runs/<stamp>)
//     --judge <model>  grader model        (default: haiku)
//     --dry-run        print the plan, run nothing
//
// Output shape is what aggregate-skill-eval.mjs expects: one grading.json per
// <eval>/<variant>/ with an `expectations` array whose entries carry `passed`.

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RUN_TIMEOUT_MS = 10 * 60 * 1000;

// Each arm differs only in which skills the run can see. That is the whole
// point: a skill that scores the same as `no_skill` is not earning its tokens.
const VARIANT_ARGS = {
	no_skill: () => ["--disable-slash-commands"],
	current: () => [],
	candidate: (candidateDir) => ["--plugin-dir", candidateDir],
};

function parseArgs(argv) {
	const opts = {
		skill: null,
		variants: ["no_skill", "current"],
		caseName: null,
		out: null,
		judge: "haiku",
		candidateDir: REPO,
		dryRun: false,
	};
	const rest = [];
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--variants") opts.variants = argv[++i].split(",");
		else if (a === "--case") opts.caseName = argv[++i];
		else if (a === "--out") opts.out = argv[++i];
		else if (a === "--judge") opts.judge = argv[++i];
		else if (a === "--candidate-dir") opts.candidateDir = resolve(argv[++i]);
		else if (a === "--dry-run") opts.dryRun = true;
		else rest.push(a);
	}
	opts.skill = rest[0];
	return opts;
}

// A fixture run needs to actually branch, commit and write a PR body, so it
// gets write tools. They are bounded by cwd: the run happens inside a throwaway
// repository this script just created, never in the harness or in a project.
function claude(prompt, extraArgs, model, cwd) {
	const args = cwd
		? ["-p", "--disallowed-tools", "NotebookEdit", "--dangerously-skip-permissions"]
		: ["-p", "--disallowed-tools", "Bash,Write,Edit,NotebookEdit"];
	if (model) args.push("--model", model);
	args.push(...extraArgs);

	// Windows needs a shell here: `claude` resolves to a .cmd, and since
	// CVE-2024-27980 Node refuses to spawn one directly (EINVAL).
	//
	// `shell: true` concatenates the args unescaped, so nothing untrusted may
	// travel in them. Nothing does: the prompt — the only free-form text — goes
	// on stdin, and every arg here is a constant or a path we resolved. The path
	// is quoted anyway, because a directory with a space is not exotic.
	const needsShell = process.platform === "win32";
	const safeArgs = needsShell
		? args.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a))
		: args;

	const r = spawnSync("claude", safeArgs, {
		input: prompt,
		encoding: "utf8",
		timeout: RUN_TIMEOUT_MS,
		maxBuffer: 32 * 1024 * 1024,
		shell: needsShell,
		cwd: cwd || undefined,
	});

	if (r.error) return { ok: false, text: `spawn failed: ${r.error.message}` };
	if (r.status !== 0) {
		return { ok: false, text: `exit ${r.status}\n${r.stderr || ""}${r.stdout || ""}` };
	}
	return { ok: true, text: r.stdout.trim() };
}

// The judge sees the assertion and the transcript, never the skill. It is asked
// for a verdict per assertion, so one soft assertion cannot carry the others.
function grade(evalItem, transcript, judgeModel) {
	const prompt = `You are grading one run of an agent against written expectations.

You are NOT grading whether the answer is good. You are grading, for each
expectation, whether the transcript satisfies it. An expectation phrased as a
prohibition ("Does NOT ...") passes only when the transcript actually avoided
the thing.

Absence of evidence is a failure, not a pass: if the transcript never addresses
an expectation, it did not satisfy it.

## Task the agent was given
${evalItem.prompt}

## Expectations
${evalItem.assertions.map((a, i) => `${i + 1}. ${a}`).join("\n")}

## Transcript
${transcript}

## Output
Return ONLY a JSON object, no prose and no code fence:
{"expectations":[{"index":1,"assertion":"<verbatim>","passed":true|false,"reason":"<one sentence>"}]}`;

	const r = claude(prompt, ["--disable-slash-commands"], judgeModel, null);
	if (!r.ok) return { error: r.text, expectations: [] };

	const match = r.text.match(/\{[\s\S]*\}/);
	if (!match) return { error: `judge returned no JSON:\n${r.text}`, expectations: [] };
	try {
		return JSON.parse(match[0]);
	} catch (e) {
		return { error: `judge JSON invalid: ${e.message}`, expectations: [] };
	}
}

function main() {
	const opts = parseArgs(process.argv.slice(2));
	if (!opts.skill) {
		console.error("usage: node scripts/run-skill-eval.mjs <skill> [--variants a,b] [--case n] [--out d] [--judge m] [--dry-run]");
		process.exit(1);
	}

	const evalsPath = join(REPO, "skills", opts.skill, "evals", "evals.json");
	const suite = JSON.parse(readFileSync(evalsPath, "utf8"));
	const items = opts.caseName
		? suite.evals.filter((e) => e.name === opts.caseName)
		: suite.evals;

	if (!items.length) {
		console.error(`no eval named "${opts.caseName}" in ${evalsPath}`);
		process.exit(1);
	}

	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	const workspace = opts.out
		? resolve(opts.out)
		: join(REPO, "skills", opts.skill, "evals", "runs", stamp);

	console.log(`skill      ${opts.skill}`);
	console.log(`evals      ${items.length}`);
	console.log(`variants   ${opts.variants.join(", ")}`);
	console.log(`runs       ${items.length * opts.variants.length}`);
	console.log(`workspace  ${workspace}`);
	console.log("");

	if (opts.dryRun) {
		for (const item of items) {
			for (const v of opts.variants) console.log(`  would run  ${item.name} / ${v}`);
		}
		return;
	}

	for (const item of items) {
		for (const variant of opts.variants) {
			const build = VARIANT_ARGS[variant];
			if (!build) {
				console.error(`unknown variant "${variant}"`);
				process.exit(1);
			}

			const dir = join(workspace, item.name, variant);
			mkdirSync(dir, { recursive: true });

			process.stdout.write(`  ${item.name} / ${variant} ... `);

			// Each arm gets its own copy, so one arm's commits cannot be read as
			// another arm's evidence.
			let repo = null;
			if (item.fixture) {
				repo = join(dir, "repo");
				execFileSync(
					process.execPath,
					[join(REPO, "scripts", "setup-eval-fixture.mjs"), opts.skill, item.fixture, repo],
					{ stdio: "pipe" },
				);
			}

			const run = claude(item.prompt, build(opts.candidateDir), null, repo);
			writeFileSync(join(dir, "output.txt"), run.text);
			writeFileSync(
				join(dir, "run.json"),
				`${JSON.stringify({ variant, prompt: item.prompt, ok: run.ok }, null, 2)}\n`,
			);

			if (!run.ok) {
				writeFileSync(
					join(dir, "grading.json"),
					`${JSON.stringify({ error: run.text, expectations: item.assertions.map((a, i) => ({ index: i + 1, assertion: a, passed: false, reason: "run failed" })) }, null, 2)}\n`,
				);
				console.log("RUN FAILED");
				continue;
			}

			// What the agent DID outranks what it said it would do, so the judge
			// reads the repository state alongside the answer.
			let transcript = run.text;
			if (repo) {
				const g = (...a) => {
					try {
						return execFileSync("git", a, { cwd: repo, encoding: "utf8", stdio: "pipe" }).trim();
					} catch {
						return "(unavailable)";
					}
				};
				transcript = [
					"## What the agent answered",
					run.text,
					"",
					"## Repository state after the run",
					`branch: ${g("rev-parse", "--abbrev-ref", "HEAD")}`,
					`commits:
${g("log", "--oneline", "--all")}`,
					`status:
${g("status", "--short") || "(clean)"}`,
					`last commit message:
${g("log", "-1", "--pretty=%B")}`,
				].join("\n");
				writeFileSync(join(dir, "transcript.txt"), transcript);
			}

			const grading = grade(item, transcript, opts.judge);
			writeFileSync(join(dir, "grading.json"), `${JSON.stringify(grading, null, 2)}\n`);

			const passed = (grading.expectations || []).filter((e) => e.passed).length;
			const total = grading.expectations?.length || 0;
			console.log(grading.error ? `GRADING FAILED` : `${passed}/${total}`);
		}
	}

	console.log(`\nworkspace: ${workspace}`);
	console.log(`aggregate: bun <railly>/scripts/aggregate-skill-eval.mjs ${opts.skill} ${workspace}`);
}

main();
