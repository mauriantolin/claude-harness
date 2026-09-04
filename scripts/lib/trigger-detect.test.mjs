import { test } from "node:test";
import assert from "node:assert/strict";
import { finalResult, isCompleteRun, judgeTrigger, skillInvocations } from "./trigger-detect.mjs";

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
