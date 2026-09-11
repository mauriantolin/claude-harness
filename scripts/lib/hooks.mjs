// The decision half of every hook under hooks/: pure functions over the JSON
// Claude Code writes to a hook's stdin, so the entry files stay thin and this
// part is testable without spawning anything.

// A plugin-served skill is invoked as `plugin:name`; a user skill as `name`.
// Same rule as trigger-detect's judgeTrigger, applied to one tool call.
export function invokesSkill(input, name) {
	if (!input || input.tool_name !== "Skill") return false;
	const skill = input.tool_input?.skill;
	if (typeof skill !== "string") return false;
	return skill === name || skill.endsWith(`:${name}`);
}

// The eval runner has no arm for "the skill without its hook" once the hook
// is registered, and toggling settings.json between runs is not reproducible.
// The hook honors this variable instead; the runner sets it with --env.
export const OFF_SWITCH = "FACTORY_LOOP_CHECKPOINTS";

// PostToolUse on a Skill call that loaded factory-loop: hand the model the
// addendum as additional context. Any other call gets nothing, so the hook is
// silent on every unrelated tool use.
export function factoryLoopCheckpoint(input, addendum, env = process.env) {
	if (env[OFF_SWITCH] === "off") return null;
	if (!invokesSkill(input, "factory-loop")) return null;
	return {
		hookSpecificOutput: {
			hookEventName: "PostToolUse",
			additionalContext: addendum,
		},
	};
}
