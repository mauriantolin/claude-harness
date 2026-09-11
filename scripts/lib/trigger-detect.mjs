// Reads a `claude -p --output-format stream-json` transcript: which skills the
// agent invoked, and what it finally answered.

function events(streamText) {
	const out = [];
	for (const line of streamText.split(/\r?\n/)) {
		if (!line.startsWith("{")) continue;
		try {
			out.push(JSON.parse(line));
		} catch {
			// A partial or non-JSON line carries nothing the readers below need.
		}
	}
	return out;
}

// A run that reached a `result` event is a complete transcript, whatever the
// exit status: hitting --max-turns exits 1 and still ends with one.
export function isCompleteRun(streamText) {
	return events(streamText).some((e) => e?.type === "result");
}

// The last assistant message's text blocks, joined. What the agent said when
// the session ended without a `result` text (a max-turns stop, for instance).
export function lastAssistantText(streamText) {
	let text = "";
	for (const event of events(streamText)) {
		const blocks = event?.type === "assistant" ? event.message?.content : null;
		if (!Array.isArray(blocks)) continue;
		const t = blocks.filter((b) => b?.type === "text" && typeof b.text === "string").map((b) => b.text).join("\n");
		if (t.trim()) text = t;
	}
	return text;
}

// The text of the last `result` event, falling back to the last assistant
// text, or empty when the run produced neither.
export function finalResult(streamText) {
	let text = "";
	for (const event of events(streamText)) {
		if (event?.type === "result" && typeof event.result === "string" && event.result.trim()) text = event.result;
	}
	return text || lastAssistantText(streamText);
}

export function skillInvocations(streamText) {
	const names = [];
	for (const event of events(streamText)) {
		const blocks = event?.message?.content;
		if (!Array.isArray(blocks)) continue;
		for (const block of blocks) {
			if (block?.type === "tool_use" && block.name === "Skill" && typeof block.input?.skill === "string") {
				names.push(block.input.skill);
			}
		}
	}
	return names;
}

// The subset of invocations whose tool_result was not an error: the skills
// that actually loaded. A plugin skill in a headless run without `Skill`
// permission is invoked and then denied ("Execute skill: x", is_error), and
// a run graded on that call would be measuring the model, not the skill.
export function skillLoads(streamText) {
	const pending = new Map();
	const failed = new Set();
	for (const event of events(streamText)) {
		const blocks = event?.message?.content;
		if (!Array.isArray(blocks)) continue;
		for (const block of blocks) {
			if (block?.type === "tool_use" && block.name === "Skill" && typeof block.input?.skill === "string") {
				pending.set(block.id, block.input.skill);
			} else if (block?.type === "tool_result" && block.is_error === true && pending.has(block.tool_use_id)) {
				failed.add(block.tool_use_id);
			}
		}
	}
	return [...pending].filter(([id]) => !failed.has(id)).map(([, name]) => name);
}

// A plugin-served skill is invoked as `plugin:name`; a user skill as `name`.
export function judgeTrigger(invocations, skillName) {
	return invocations.some((n) => n === skillName || n.endsWith(`:${skillName}`));
}
