import assert from "node:assert/strict";
import { test } from "node:test";
import { factoryLoopCheckpoint, invokesSkill } from "./hooks.mjs";

const skillCall = (skill) => ({ tool_name: "Skill", tool_input: { skill } });

test("invokesSkill matches the bare name and the plugin-prefixed name", () => {
	assert.equal(invokesSkill(skillCall("factory-loop"), "factory-loop"), true);
	assert.equal(invokesSkill(skillCall("experimental:factory-loop"), "factory-loop"), true);
});

test("invokesSkill rejects other skills, other tools and malformed input", () => {
	assert.equal(invokesSkill(skillCall("work-intake"), "factory-loop"), false);
	assert.equal(invokesSkill(skillCall("factory-loop-extras"), "factory-loop"), false);
	assert.equal(invokesSkill({ tool_name: "Bash", tool_input: { command: "factory-loop" } }, "factory-loop"), false);
	assert.equal(invokesSkill({ tool_name: "Skill", tool_input: {} }, "factory-loop"), false);
	assert.equal(invokesSkill(null, "factory-loop"), false);
});

test("factoryLoopCheckpoint returns PostToolUse additional context for factory-loop only", () => {
	const out = factoryLoopCheckpoint(skillCall("experimental:factory-loop"), "ADDENDUM");
	assert.deepEqual(out, {
		hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: "ADDENDUM" },
	});
	assert.equal(factoryLoopCheckpoint(skillCall("ship"), "ADDENDUM"), null);
});

test("factoryLoopCheckpoint is silent when the off switch is set, and only then", () => {
	const call = skillCall("factory-loop");
	assert.equal(factoryLoopCheckpoint(call, "A", { FACTORY_LOOP_CHECKPOINTS: "off" }), null);
	assert.notEqual(factoryLoopCheckpoint(call, "A", { FACTORY_LOOP_CHECKPOINTS: "on" }), null);
	assert.notEqual(factoryLoopCheckpoint(call, "A", {}), null);
});
