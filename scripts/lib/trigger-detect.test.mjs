import { test } from "node:test";
import assert from "node:assert/strict";
import { finalResult, isCompleteRun, judgeTrigger, skillInvocations, skillLoads } from "./trigger-detect.mjs";

const stream = [
	'{"type":"system","subtype":"init"}',
	'{"type":"assistant","message":{"content":[{"type":"text","text":"hi"},{"type":"tool_use","name":"Skill","input":{"skill":"frontend-stack"}}]}}',
	"not json at all",
	'{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Skill","input":{"skill":"vercel:shadcn","args":""}}]}}',
	'{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Read","input":{"file_path":"x"}}]}}',
	'{"type":"result","result":"done"}',
].join("\n");

test("skillInvocations lists every Skill tool call in order, ignoring junk lines", () => {
	assert.deepEqual(skillInvocations(stream), ["frontend-stack", "vercel:shadcn"]);
	assert.deepEqual(skillInvocations(""), []);
});

test("skillLoads keeps only the Skill calls whose result was not an error", () => {
	const denied = [
		'{"type":"assistant","message":{"content":[{"type":"tool_use","id":"t1","name":"Skill","input":{"skill":"experimental:factory-loop"}}]}}',
		'{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"t1","content":"Execute skill: experimental:factory-loop","is_error":true}]}}',
		'{"type":"assistant","message":{"content":[{"type":"tool_use","id":"t2","name":"Skill","input":{"skill":"spec-gate"}}]}}',
		'{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"t2","content":"Launching skill: spec-gate"}]}}',
		'{"type":"assistant","message":{"content":[{"type":"tool_use","id":"t3","name":"Skill","input":{"skill":"ship"}}]}}',
		'{"type":"result","result":"done"}',
	].join("\n");
	assert.deepEqual(skillInvocations(denied), ["experimental:factory-loop", "spec-gate", "ship"]);
	assert.deepEqual(skillLoads(denied), ["spec-gate", "ship"]);
	assert.equal(judgeTrigger(skillLoads(denied), "factory-loop"), false);
	assert.deepEqual(skillLoads(""), []);
});

test("finalResult returns the last result event's text, else the last assistant text, else empty", () => {
	assert.equal(finalResult(stream), "done");
	const maxTurns = [
		'{"type":"assistant","message":{"content":[{"type":"text","text":"first"}]}}',
		'{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Read","input":{}}]}}',
		'{"type":"assistant","message":{"content":[{"type":"text","text":"I will now"},{"type":"text","text":"do it"}]}}',
		'{"type":"result","subtype":"error_max_turns","is_error":true}',
	].join("\n");
	assert.equal(finalResult(maxTurns), "I will now\ndo it");
	assert.equal(finalResult('{"type":"assistant","message":{"content":[]}}'), "");
	assert.equal(finalResult(""), "");
});

test("isCompleteRun is true only when a result event exists", () => {
	assert.equal(isCompleteRun(stream), true);
	assert.equal(isCompleteRun('{"type":"result","subtype":"error_max_turns"}'), true);
	assert.equal(isCompleteRun('{"type":"assistant","message":{"content":[]}}'), false);
	assert.equal(isCompleteRun("exit 1\nsome stderr"), false);
});

test("judgeTrigger matches a bare name or a plugin-prefixed one", () => {
	assert.equal(judgeTrigger(["frontend-stack"], "frontend-stack"), true);
	assert.equal(judgeTrigger(["delivery:frontend-stack"], "frontend-stack"), true);
	assert.equal(judgeTrigger(["vercel:shadcn"], "frontend-stack"), false);
	assert.equal(judgeTrigger([], "frontend-stack"), false);
});
