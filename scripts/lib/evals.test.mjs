import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, renderBenchmark, validateEvalSuite, validateTriggers } from "./evals.mjs";

const good = {
	skill_name: "ship",
	evals: [
		{ id: 1, name: "one", prompt: "do it", expected_output: "done", assertions: ["Does X"], fixture: "fx", files: [] },
		{ id: 2, name: "two", prompt: "again", expected_output: "done", assertions: ["Does Y"], files: [] },
	],
};

test("validateEvalSuite accepts a well-formed suite", () => {
	assert.deepEqual(validateEvalSuite(good, "ship", { fixtures: ["fx"] }), []);
});

test("validateEvalSuite reports every structural defect by eval name", () => {
	const bad = {
		skill_name: "other",
		evals: [
			{ id: 1, name: "dup", prompt: "", assertions: [] },
			{ id: 1, name: "dup", prompt: "p", assertions: ["a"], fixture: "missing" },
			{ id: 3, prompt: "p", assertions: "not-a-list" },
		],
	};
	const text = validateEvalSuite(bad, "ship", { fixtures: [] }).join("\n");
	assert.match(text, /skill_name "other" does not match "ship"/);
	assert.match(text, /dup: prompt is empty/);
	assert.match(text, /dup: assertions is empty/);
	assert.match(text, /duplicate id 1/);
	assert.match(text, /duplicate name "dup"/);
	assert.match(text, /fixture "missing" does not exist/);
	assert.match(text, /#3: name is missing/);
	assert.match(text, /#3: assertions must be a list/);
});

test("validateTriggers wants a non-empty list with both polarities", () => {
	assert.deepEqual(
		validateTriggers([
			{ query: "yes", should_trigger: true },
			{ query: "no", should_trigger: false },
		]),
		[],
	);
	const text = validateTriggers([{ query: "only positive", should_trigger: true }, { should_trigger: "x" }]).join("\n");
	assert.match(text, /no negative/);
	assert.match(text, /#2: query is missing/);
	assert.match(text, /#2: should_trigger must be boolean/);
	assert.match(validateTriggers([]).join("\n"), /empty/);
	assert.match(validateTriggers({}).join("\n"), /must be a list/);
});

test("aggregate tallies only the variants present and computes the deltas it can", () => {
	const gradings = {
		one: {
			no_skill: { expectations: [{ passed: true }, { passed: false }] },
			current: { expectations: [{ passed: true }, { passed: true }], skill_invoked: true },
		},
		two: {
			no_skill: { expectations: [{ passed: false }] },
			current: { expectations: [{ passed: true }], skill_invoked: false },
		},
	};
	const b = aggregate("ship", "stamp", gradings);
	assert.equal(b.variants.no_skill.passed, 1);
	assert.equal(b.variants.no_skill.total, 3);
	assert.equal(b.variants.current.pass_rate, 1);
	assert.equal(b.current_delta_vs_no_skill, 1 - 1 / 3);
	assert.equal(b.candidate_delta_vs_current, null);
	assert.deepEqual(Object.keys(b.variants), ["no_skill", "current"]);
	assert.equal(b.variants.current.evals.two.pass_rate, 1);
	assert.equal(b.variants.current.evals.two.skill_invoked, false);
	assert.equal(b.variants.current.invoked, 1);
	assert.equal(b.variants.current.runs, 2);
	assert.equal(b.variants.no_skill.invoked, 0);
});

test("aggregate refuses an eval missing a variant the others have", () => {
	assert.throws(
		() =>
			aggregate("s", "x", {
				a: { no_skill: { expectations: [] }, current: { expectations: [] } },
				b: { no_skill: { expectations: [] } },
			}),
		/b is missing variant current/,
	);
});

test("renderBenchmark is a markdown table with the deltas that exist", () => {
	const md = renderBenchmark(
		aggregate("ship", "stamp", {
			one: { no_skill: { expectations: [{ passed: false }] }, current: { expectations: [{ passed: true }] } },
		}),
	);
	assert.match(md, /# ship benchmark/);
	assert.match(md, /\| no_skill \| 0 \| 1 \| 0\.0% \| 0\/1 \|/);
	assert.match(md, /\| current \| 1 \| 1 \| 100\.0% \| 0\/1 \|/);
	assert.match(md, /Current delta versus no skill: 100\.0%/);
	assert.doesNotMatch(md, /Candidate delta/);
});
