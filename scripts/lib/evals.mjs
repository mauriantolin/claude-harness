// Eval suite validation and benchmark aggregation.
//
// The suite shape is the one skill-creator and Railly Skills share:
// `evals.json` with `skill_name` and `evals[]`, each carrying `name`, `prompt`,
// `assertions` and an optional `fixture` with its `verification`. Trigger
// cases carry `id`, `query` and `should_trigger`. Both files pass Railly's
// `validate-skills.mjs` unchanged. A run writes one `grading.json` per eval
// and variant, with `expectations[].passed`, and the aggregate reads that.

export const VARIANTS = ["no_skill", "bare", "current", "candidate"];

export function validateEvalSuite(suite, skillName, { fixtures = [] } = {}) {
	const errors = [];
	if (!suite || typeof suite !== "object") return ["evals.json is not an object"];
	if (suite.skill_name !== skillName) {
		errors.push(`skill_name "${suite.skill_name}" does not match "${skillName}"`);
	}
	if (!Array.isArray(suite.evals)) return [...errors, "evals must be a list"];
	if (suite.evals.length === 0) errors.push("evals is empty");

	const ids = new Set();
	const names = new Set();
	suite.evals.forEach((item, i) => {
		const label = item.name ? item.name : `#${i + 1}`;
		if (!item.name) errors.push(`${label}: name is missing`);
		else if (names.has(item.name)) errors.push(`${label}: duplicate name "${item.name}"`);
		names.add(item.name);

		if (item.id === undefined) errors.push(`${label}: id is missing`);
		else if (ids.has(item.id)) errors.push(`${label}: duplicate id ${item.id}`);
		ids.add(item.id);

		if (typeof item.prompt !== "string" || item.prompt.trim() === "") {
			errors.push(`${label}: prompt is empty`);
		}
		if (typeof item.expected_output !== "string" || item.expected_output.trim() === "") {
			errors.push(`${label}: expected_output is empty`);
		}
		if (!Array.isArray(item.files)) errors.push(`${label}: files must be a list`);
		if (!Array.isArray(item.assertions)) errors.push(`${label}: assertions must be a list`);
		else if (item.assertions.length === 0) errors.push(`${label}: assertions is empty`);

		if (item.fixture !== undefined && !fixtures.includes(item.fixture)) {
			errors.push(`${label}: fixture "${item.fixture}" does not exist`);
		}
		// A fixture eval declares how to prove the materialized fixture is the
		// state it claims to be (a green suite, a failing check). Same shape as
		// Railly's: a command array and the exit code it must produce.
		if (item.fixture_repo !== undefined && typeof item.fixture_repo?.source !== "string") {
			errors.push(`${label}: fixture_repo needs a source path`);
		}
		if (item.fixture !== undefined && item.verification === undefined) {
			errors.push(`${label}: a fixture eval needs a verification { command, expected_exit }`);
		}
		if (item.verification !== undefined) {
			const v = item.verification;
			if (!Array.isArray(v?.command) || v.command.length === 0 || !v.command.every((c) => typeof c === "string")) {
				errors.push(`${label}: verification.command must be a non-empty list of strings`);
			}
			if (!Number.isInteger(v?.expected_exit)) errors.push(`${label}: verification.expected_exit must be an integer`);
		}
	});
	return errors;
}

export function validateTriggers(triggers) {
	if (!Array.isArray(triggers)) return ["triggers.json must be a list"];
	if (triggers.length === 0) return ["triggers.json is empty"];
	const errors = [];
	const ids = new Set();
	triggers.forEach((t, i) => {
		const label = `#${i + 1}`;
		if (typeof t?.id !== "string" || t.id.trim() === "") errors.push(`${label}: id is missing`);
		else if (ids.has(t.id)) errors.push(`${label}: duplicate id "${t.id}"`);
		ids.add(t?.id);
		if (typeof t?.query !== "string" || t.query.trim() === "") errors.push(`${label}: query is missing`);
		if (typeof t?.should_trigger !== "boolean") errors.push(`${label}: should_trigger must be boolean`);
	});
	if (!triggers.some((t) => t?.should_trigger === true)) errors.push("no positive trigger case");
	if (!triggers.some((t) => t?.should_trigger === false)) errors.push("no negative trigger case");
	return errors;
}

// gradings: { [evalName]: { [variant]: grading } }. Every eval must carry the
// same variant set; a partial run is reported, never averaged over.
//
// A grading may carry `skill_invoked`: whether the skill under test was
// actually loaded during the run. A `current` arm that never loaded the skill
// measured the model, and the invocation column is what says so.
export function aggregate(skillName, iteration, gradings) {
	const evalNames = Object.keys(gradings).sort();
	const present = VARIANTS.filter((v) => evalNames.some((e) => gradings[e][v]));
	const variants = Object.fromEntries(
		present.map((v) => [v, { passed: 0, total: 0, pass_rate: 0, runs: 0, invoked: 0, evals: {} }]),
	);

	for (const name of evalNames) {
		for (const variant of present) {
			const grading = gradings[name][variant];
			if (!grading) throw new Error(`${name} is missing variant ${variant}`);
			const expectations = grading.expectations ?? [];
			const passed = expectations.filter((e) => e.passed).length;
			const total = expectations.length;
			const invoked = grading.skill_invoked === true;
			variants[variant].passed += passed;
			variants[variant].total += total;
			variants[variant].runs += 1;
			variants[variant].invoked += invoked ? 1 : 0;
			variants[variant].evals[name] = { passed, total, pass_rate: total ? passed / total : 0, skill_invoked: invoked };
		}
	}
	for (const v of present) {
		variants[v].pass_rate = variants[v].total ? variants[v].passed / variants[v].total : 0;
	}
	const rate = (v) => (variants[v] ? variants[v].pass_rate : null);
	const delta = (a, b) => (rate(a) === null || rate(b) === null ? null : rate(a) - rate(b));

	return {
		skill_name: skillName,
		iteration,
		variants,
		candidate_delta_vs_current: delta("candidate", "current"),
		current_delta_vs_no_skill: delta("current", "no_skill"),
	};
}

const percent = (value) => `${(value * 100).toFixed(1)}%`;

export function renderBenchmark(benchmark) {
	const lines = [
		`# ${benchmark.skill_name} benchmark`,
		"",
		"| Variant | Passed | Total | Pass rate | Skill loaded |",
		"|---|---:|---:|---:|---:|",
		...Object.entries(benchmark.variants).map(
			([v, r]) => `| ${v} | ${r.passed} | ${r.total} | ${percent(r.pass_rate)} | ${r.invoked}/${r.runs} |`,
		),
		"",
	];
	if (benchmark.current_delta_vs_no_skill !== null) {
		lines.push(`Current delta versus no skill: ${percent(benchmark.current_delta_vs_no_skill)}`, "");
	}
	if (benchmark.candidate_delta_vs_current !== null) {
		lines.push(`Candidate delta versus current: ${percent(benchmark.candidate_delta_vs_current)}`, "");
	}
	return `${lines.join("\n")}\n`;
}

// Deterministic checks an eval may carry beside its judged assertions, read
// from what the session did (the tool timeline) and what it left (the
// repository). Each becomes one expectation in grading.json, so a benchmark
// counts it like any assertion, but no judge decides it.
//
//   { "loaded_in_order": ["route", "acme-ui"] }      a subsequence of the skills that loaded
//   { "not_loaded": ["ui-design-language"] }          none of these loaded
//   { "loaded_before_edit": "acme-ui", "path": "web/" } loaded before the first Write/Edit whose path contains `path`
//   { "file_contains": ".agents/verify/contract.md", "pattern": "## Routing" }
//   { "no_command": "git push" }                      no Bash command contained this text
//   { "ran_command": "observe.sh list" }              some Bash command contained this text
//   { "no_edit": "apps/" }                            no Write/Edit (or Bash write) touched a path containing this
//   { "origin_empty": true }                          a fixture_repo's bare origin received no push
const named = (loaded, want) => loaded === want || loaded.endsWith(`:${want}`);

// The files a Bash command writes: a redirect's target, tee's, sed -i's or perl -pi's last
// argument, cp's or mv's destination. A heredoc that only mentions a path writes nothing there.
export function bashTargets(call) {
	if (call?.tool !== "Bash" || !call.ok || typeof call.command !== "string") return [];
	const body = call.command.replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2\b/g, "<<heredoc");
	const targets = [];
	for (const m of body.matchAll(/(?:^|[^<>&\d])>>?\s*([^\s;&|<>]+)/g)) targets.push(m[1]);
	for (const m of body.matchAll(/\btee\s+(?:-a\s+)?([^\s;&|]+)/g)) targets.push(m[1]);
	for (const m of body.matchAll(/\b(?:sed\s+-i\S*|perl\s+-pi\S*)\s+(?:'[^']*'|"[^"]*"|\S+)\s+([^\s;&|]+)/g)) targets.push(m[1]);
	for (const m of body.matchAll(/\b(?:cp|mv)\s+(?:-\S+\s+)*\S+\s+([^\s;&|]+)/g)) targets.push(m[1]);
	return targets.filter((t) => t !== "/dev/null");
}

export function runChecks(checks = [], timeline = [], readRepoFile = () => null, originRefs = () => null) {
	const loads = timeline.filter((c) => c.skill && c.ok).map((c) => c.skill);
	return checks.map((check) => {
		if (check.loaded_in_order) {
			let i = 0;
			for (const s of loads) if (i < check.loaded_in_order.length && named(s, check.loaded_in_order[i])) i++;
			const passed = i === check.loaded_in_order.length;
			return { assertion: `[check] loaded in order: ${check.loaded_in_order.join(" → ")}`, passed, reason: `loads: ${loads.join(", ") || "(none)"}` };
		}
		if (check.not_loaded) {
			const hit = loads.filter((s) => check.not_loaded.some((n) => named(s, n)));
			return { assertion: `[check] not loaded: ${check.not_loaded.join(", ")}`, passed: hit.length === 0, reason: hit.length ? `loaded ${hit.join(", ")}` : "none loaded" };
		}
		if (check.loaded_before_edit) {
			// An edit is a Write/Edit on the path, or a Bash command that writes to it (a heredoc,
			// a redirect, sed -i, tee, cp or mv onto it): agents implement with both.
			const writesByBash = (c) => bashTargets(c).some((t) => t.includes(check.path ?? ""));
			const edit = timeline.findIndex(
				// A blocked edit (a hook refused it) changed nothing: the first edit is the first that went through.
				(c) => c.ok && ((["Write", "Edit", "MultiEdit"].includes(c.tool) && c.path?.includes(check.path ?? "")) || writesByBash(c)),
			);
			const load = timeline.findIndex((c) => c.ok && c.skill && named(c.skill, check.loaded_before_edit));
			const passed = load !== -1 && (edit === -1 || load < edit);
			const reason = load === -1 ? "never loaded" : edit === -1 ? "loaded; no matching edit" : `load #${load}, first edit #${edit}`;
			return { assertion: `[check] ${check.loaded_before_edit} loaded before editing ${check.path ?? "any file"}`, passed, reason };
		}
		if (check.file_contains) {
			const body = readRepoFile(check.file_contains);
			const passed = body != null && new RegExp(check.pattern).test(body);
			return { assertion: `[check] ${check.file_contains} matches /${check.pattern}/`, passed, reason: body == null ? "file absent" : passed ? "matches" : "no match" };
		}
		if (check.no_command) {
			const hit = timeline.find((c) => c.command?.includes(check.no_command));
			return { assertion: `[check] never ran \`${check.no_command}\``, passed: !hit, reason: hit ? hit.command.slice(0, 200) : "not run" };
		}
		if (check.no_edit) {
			const hit = timeline.find(
				(c) =>
					(["Write", "Edit", "MultiEdit"].includes(c.tool) && c.path?.includes(check.no_edit)) ||
					bashTargets(c).some((t) => t.includes(check.no_edit)),
			);
			return { assertion: `[check] nothing under ${check.no_edit} was edited`, passed: !hit, reason: hit ? (hit.path ?? hit.command).slice(0, 200) : "no edit" };
		}
		if (check.origin_empty) {
			const refs = originRefs();
			return { assertion: "[check] no push reached origin", passed: refs !== null && refs.length === 0, reason: refs === null ? "no fixture_repo origin" : refs.length ? `origin has ${refs.join(", ")}` : "origin empty" };
		}
		if (check.ran_command) {
			const hit = timeline.find((c) => c.command?.includes(check.ran_command));
			return { assertion: `[check] ran \`${check.ran_command}\``, passed: Boolean(hit), reason: hit ? hit.command.slice(0, 200) : "never ran" };
		}
		return { assertion: `[check] unknown ${JSON.stringify(check)}`, passed: false, reason: "unknown check" };
	});
}
