// Eval suite validation and benchmark aggregation.
//
// The suite shape is the one skill-creator and Railly Skills share:
// `evals.json` with `skill_name` and `evals[]`, each carrying `name`, `prompt`,
// `assertions` and an optional `fixture`. A run writes one `grading.json` per
// eval and variant, with `expectations[].passed`, and the aggregate reads that.

export const VARIANTS = ["no_skill", "current", "candidate"];

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
		if (!Array.isArray(item.assertions)) errors.push(`${label}: assertions must be a list`);
		else if (item.assertions.length === 0) errors.push(`${label}: assertions is empty`);

		if (item.fixture !== undefined && !fixtures.includes(item.fixture)) {
			errors.push(`${label}: fixture "${item.fixture}" does not exist`);
		}
	});
	return errors;
}

export function validateTriggers(triggers) {
	if (!Array.isArray(triggers)) return ["triggers.json must be a list"];
	if (triggers.length === 0) return ["triggers.json is empty"];
	const errors = [];
	triggers.forEach((t, i) => {
		const label = `#${i + 1}`;
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
