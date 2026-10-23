// The decision half of every hook under hooks/: pure functions over the JSON
// Claude Code writes to a hook's stdin, so the entry files stay thin and this
// part is testable without spawning anything.

import { existsSync } from "node:fs";
import { join } from "node:path";

// A plugin-served skill is invoked as `plugin:name`; a user skill as `name`.
// Same rule as trigger-detect's judgeTrigger, applied to one tool call.
export function invokesSkill(input, name) {
	if (!input || input.tool_name !== "Skill") return false;
	const skill = input.tool_input?.skill;
	if (typeof skill !== "string") return false;
	return skill === name || skill.endsWith(`:${name}`);
}

// The eval runner measures a hook against the same suite with the hook
// switched off; toggling settings.json between runs is not reproducible, so
// every hook honors its own variable and the runner sets it with --env.
export const OFF = {
	loopBindings: "HARNESS_LOOP_BINDINGS",
	verifyBeforeDone: "HARNESS_VERIFY_BEFORE_DONE",
	knowledgeRoot: "HARNESS_KNOWLEDGE_ROOT",
	routeGuard: "HARNESS_ROUTE_GUARD",
	loopEntry: "HARNESS_LOOP_ENTRY",
};

// The Railly skills that open a change. Loading either is the moment the
// repository's binding has to be in context, before the contract is written.
const LOOP_ENTRIES = ["loop", "contract"];

// PostToolUse on a Skill call that loaded loop or contract: hand the model the
// bindings (where the repository's harness lives, the route step, the deploy
// step). Any other call gets nothing, so the hook is silent on unrelated work.
export function loopBindings(input, bindings, env = process.env) {
	if (env[OFF.loopBindings] === "off") return null;
	if (!LOOP_ENTRIES.some((name) => invokesSkill(input, name))) return null;
	return {
		hookSpecificOutput: {
			hookEventName: "PostToolUse",
			additionalContext: bindings,
		},
	};
}

// Stop: a change in progress may not end while fresh.sh says a contract feature has no passing
// observation of this exact tree. A change in progress is a contract, or, in a harnessed
// repository (.agents/harness.md), a session that edited files: measured, agents skipped the
// contract on small changes and with it every later check, so editing without one blocks too.
// Only this session's own edits count (its transcript), never work already in the tree.
// `stop_hook_active` means this stop already follows a block: the second attempt passes, so a
// gap the agent cannot close ends as a stated gap, not as a loop. Returns the reason, or null.
export function verifyBeforeDone(input, root, runFresh, sessionEdited = () => false, env = process.env) {
	if (env[OFF.verifyBeforeDone] === "off") return null;
	if (!root || input?.stop_hook_active) return null;
	const kit = join(root, ".agents", "verify");
	if (!existsSync(join(kit, "fresh.sh"))) return null;
	if (!existsSync(join(kit, "contract.md"))) {
		if (!existsSync(join(root, ".agents", "harness.md")) || !sessionEdited()) return null;
		return [
			"verify-before-done: this session edited files and there is no contract in .agents/verify/contract.md.",
			"In this repository every change goes through Railly's loop: write the contract (Skill(experimental:contract)), observe each item with `bash .agents/verify/observe.sh <feature>`, then gate.",
			"If the edit was not a change to deliver (a scratch file, a reverted experiment), say so plainly instead of claiming done.",
		].join("\n");
	}
	const r = runFresh(kit);
	if (r.status === 0) return null;
	const why = (r.stderr || r.stdout || "").trim() || `fresh.sh exited ${r.status}`;
	return [
		`verify-before-done: ${why}`,
		"The contract in .agents/verify/contract.md names features this tree has not been observed passing.",
		"Run `bash .agents/verify/observe.sh <feature>` for each one (loop step 3) before saying the work is done.",
		"If an observation cannot be made, say so as a named gap with the reason; do not claim done.",
	].join("\n");
}

// Whether a transcript (the session's, or a subagent's) has a successful-looking Write or Edit.
export function transcriptEdited(transcript) {
	return /"type":"tool_use"[^\n]*"name":"(?:Write|Edit|MultiEdit|NotebookEdit)"/.test(transcript ?? "");
}

// SessionStart: Railly's gate and correct write cases and run reports to a
// canonical root they find through RAILLY_SKILLS_REPO. A harnessed repository
// (one with .agents/) keeps that root at .agents/knowledge, ignored by git, so
// every clone and worktree gets its own without a settings.local.json.
export const KNOWLEDGE_MARKERS = {
	"foundry/maturity.json": '{\n\t"schema_version": 1,\n\t"skills": {}\n}\n',
	".claude-plugin/marketplace.json": '{\n\t"name": "knowledge",\n\t"owner": { "name": "local" },\n\t"plugins": []\n}\n',
	"cases/.gitkeep": "",
	"foundry/runs/review-gate/.gitkeep": "",
};

export function knowledgeRoot(root, env = process.env) {
	if (env[OFF.knowledgeRoot] === "off") return null;
	if (!root || !existsSync(join(root, ".agents"))) return null;
	return join(root, ".agents", "knowledge");
}

// PreToolUse(Write|Edit|MultiEdit): the route step as a check, not as prose. The repository's
// `.agents/routing.md` may carry a fenced `routes` block, one `<glob> :: <skill>[, <skill>]` per
// line (glob as bash `[[ == ]]` reads it, so `*` crosses directories, like gate.sh surfaces).
// Editing a path whose owners were not loaded in this agent's own transcript is blocked with
// the skills to load. Reading the owner's SKILL.md counts, for a runtime without the Skill tool.
export function parseRoutes(markdown) {
	const block = /^```routes\s*$([\s\S]*?)^```\s*$/m.exec(markdown ?? "")?.[1] ?? "";
	return block
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l && !l.startsWith("#") && l.includes("::"))
		.map((l) => {
			const [glob, owners] = l.split("::");
			return { glob: glob.trim(), owners: owners.split(",").map((s) => s.trim()).filter(Boolean) };
		});
}

const globMatch = (glob, path) =>
	new RegExp(`^${glob.split("").map((c) => (c === "*" ? ".*" : c === "?" ? "." : c.replace(/[.+^${}()|[\]\\]/g, "\\$&"))).join("")}$`).test(path);

// Skills an agent loaded, read from its transcript (JSONL of the session or of one subagent).
export function loadedSkills(transcript) {
	const names = new Set();
	for (const line of (transcript ?? "").split("\n")) {
		if (!line.includes('"tool_use"')) continue;
		let entry;
		try {
			entry = JSON.parse(line);
		} catch {
			continue;
		}
		for (const block of entry?.message?.content ?? []) {
			if (block?.type !== "tool_use") continue;
			if (block.name === "Skill" && typeof block.input?.skill === "string") names.add(block.input.skill);
			const read = block.name === "Read" ? block.input?.file_path : null;
			const m = typeof read === "string" ? /\.claude\/skills\/([^/]+)\/SKILL\.md$/.exec(read) : null;
			if (m) names.add(m[1]);
		}
	}
	return [...names];
}

export function routeGuard(input, root, routes, loaded, env = process.env) {
	if (env[OFF.routeGuard] === "off" || !root || !routes.length) return null;
	const file = input?.tool_input?.file_path;
	if (typeof file !== "string" || !file.startsWith(`${root}/`)) return null;
	const path = file.slice(root.length + 1);
	const has = (want) => loaded.some((n) => n === want || n.endsWith(`:${want}`));
	const missing = [...new Set(routes.filter((r) => globMatch(r.glob, path)).flatMap((r) => r.owners))].filter((o) => !has(o));
	if (!missing.length) return null;
	return [
		`route-guard: ${path} is owned by ${missing.map((m) => `\`${m}\``).join(", ")} (.agents/routing.md), and this agent has not loaded ${missing.length > 1 ? "them" : "it"}.`,
		`Load ${missing.map((m) => `Skill(${m})`).join(" and ")} first, follow ${missing.length > 1 ? "them" : "it"} for this surface, then make the edit.`,
	].join("\n");
}

// The plugin-qualified name is part of the text on purpose: Claude Code ships a built-in `loop`
// (recurring tasks), and "load Skill(loop)" loaded that one in every measured run.
// UserPromptSubmit: in a harnessed repository (one with .agents/harness.md), every request that
// changes something enters through Railly's loop. Measured: with only CLAUDE.md saying so, a
// plainly worded change ("cambiá este texto", "arreglá esto") never loaded loop, so the contract,
// the bindings and the observation never happened. A question is left alone by the text itself.
export const LOOP_ENTRY =
	"This repository takes every change through Railly's loop (.agents/harness.md). If this request asks to change code, docs or configuration, load Skill(experimental:loop) before reading or editing anything: it writes the contract, routes, observes and gates. That is Railly's skill, not Claude Code's built-in `loop` (recurring tasks), which shares the bare name. A question, an explanation or a review of nothing yet changed needs no loop.";

export function loopEntry(root, env = process.env) {
	if (env[OFF.loopEntry] === "off" || !root || !existsSync(join(root, ".agents", "harness.md"))) return null;
	return { hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: LOOP_ENTRY } };
}
