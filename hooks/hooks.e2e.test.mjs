// End to end over the real hook entry files: each test spawns the hook as
// Claude Code would (stdin JSON, cwd, env) against a throwaway git repository
// and reads exit code, stdout and stderr.
//
// Ways these hooks can fail, written before the tests:
//   loop-bindings
//     1. fires on a skill that is not loop or contract (noise on every Skill call)
//     2. stays silent on `experimental:loop` because the plugin prefix is not matched
//     3. matches a longer name that merely starts with "loop"
//     4. throws on empty or malformed stdin and shows as a hook error
//     5. ignores its off switch, so the eval baseline arm still gets the bindings
//   verify-before-done
//     6. blocks a session that has no contract (every plain question would be trapped)
//     7. lets a session stop with a contract feature unobserved on this tree
//     8. lets a stale observation (from before an edit) count
//     9. blocks forever: the second stop (stop_hook_active) must pass
//    10. blocks outside a git repository or without the kit
//   knowledge-root
//    11. scaffolds into a repository that has no .agents/ (not harnessed)
//    12. writes a root Railly's resolver rejects (missing markers)
//    13. does not export RAILLY_SKILLS_REPO to the session's env file
//    14. overwrites a marker that already exists
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const HOOKS = dirname(fileURLToPath(import.meta.url));
const RAILLY = join(homedir(), ".claude", "plugins", "marketplaces", "railly-skills");
const KIT = join(RAILLY, "skills", ".experimental", "verify-setup", "assets", "verify");

function run(hook, input, { cwd, env = {}, raw } = {}) {
	return spawnSync(process.execPath, [join(HOOKS, hook, "hook.mjs")], {
		input: raw ?? JSON.stringify(input),
		cwd,
		encoding: "utf8",
		env: { ...process.env, ...env },
	});
}

function repo({ kit = false, agents = kit } = {}) {
	const dir = mkdtempSync(join(tmpdir(), "harness-hook-"));
	const git = (...a) => execFileSync("git", a, { cwd: dir, stdio: "pipe" });
	git("init", "-q", "-b", "main");
	git("config", "user.email", "t@example.invalid");
	git("config", "user.name", "t");
	writeFileSync(join(dir, "app.txt"), "v1\n");
	if (agents) mkdirSync(join(dir, ".agents"), { recursive: true });
	if (kit) cpSync(KIT, join(dir, ".agents", "verify"), { recursive: true });
	git("add", "-A");
	git("commit", "-qm", "base");
	return dir;
}

const skill = (name) => ({ tool_name: "Skill", tool_input: { skill: name } });

test("loop-bindings injects the bindings on loop and contract, with or without the plugin prefix", () => {
	for (const name of ["loop", "experimental:loop", "contract", "experimental:contract"]) {
		const r = run("loop-bindings", skill(name));
		assert.equal(r.status, 0);
		const out = JSON.parse(r.stdout);
		assert.equal(out.hookSpecificOutput.hookEventName, "PostToolUse");
		assert.match(out.hookSpecificOutput.additionalContext, /\.agents\/harness\.md/);
		assert.match(out.hookSpecificOutput.additionalContext, /Skill\(harness:route\)/);
	}
});

test("loop-bindings is silent on other skills, other tools, longer names and bad input", () => {
	for (const input of [skill("gate"), skill("loopback"), skill("route"), { tool_name: "Bash", tool_input: { command: "loop" } }]) {
		const r = run("loop-bindings", input);
		assert.equal(r.status, 0);
		assert.equal(r.stdout, "");
	}
	const bad = run("loop-bindings", null, { raw: "not json" });
	assert.equal(bad.status, 0);
	assert.equal(bad.stdout, "");
});

test("loop-bindings honors its off switch", () => {
	const r = run("loop-bindings", skill("loop"), { env: { HARNESS_LOOP_BINDINGS: "off" } });
	assert.equal(r.stdout, "");
});

test("verify-before-done lets a session without a contract stop", () => {
	const dir = repo({ kit: true });
	const r = run("verify-before-done", { cwd: dir, stop_hook_active: false }, { cwd: dir });
	assert.equal(r.status, 0, r.stderr);
	const outside = run("verify-before-done", { cwd: tmpdir() }, { cwd: tmpdir() });
	assert.equal(outside.status, 0);
	const noKit = repo();
	writeFileSync(join(noKit, "contract.md"), "observe: app\n");
	assert.equal(run("verify-before-done", { cwd: noKit }, { cwd: noKit }).status, 0);
});

test("verify-before-done blocks while a contract feature is unobserved, and passes once observed", () => {
	const dir = repo({ kit: true });
	writeFileSync(join(dir, ".agents", "verify", "contract.md"), "# Contract\n## Acceptance\n- A1: app says v2\n  - observe: app\n");
	writeFileSync(join(dir, ".agents", "verify", "drive", "app.sh"), 'grep -q v2 app.txt && echo ok > "$EVIDENCE_DIR/proof.txt"\n');
	writeFileSync(join(dir, "app.txt"), "v2\n");

	const blocked = run("verify-before-done", { cwd: dir, stop_hook_active: false }, { cwd: dir });
	assert.equal(blocked.status, 2);
	assert.match(blocked.stderr, /verify-before-done: .*app/);

	const obs = spawnSync("bash", [".agents/verify/observe.sh", "app"], { cwd: dir, encoding: "utf8" });
	assert.equal(obs.status, 0, obs.stdout + obs.stderr);
	assert.equal(run("verify-before-done", { cwd: dir }, { cwd: dir }).status, 0);

	// An edit after the observation makes it stale.
	writeFileSync(join(dir, "app.txt"), "v2 edited\n");
	assert.equal(run("verify-before-done", { cwd: dir }, { cwd: dir }).status, 2);
});

test("verify-before-done lets the second stop through and honors its off switch", () => {
	const dir = repo({ kit: true });
	writeFileSync(join(dir, ".agents", "verify", "contract.md"), "- A1: x\n  - observe: app\n");
	assert.equal(run("verify-before-done", { cwd: dir, stop_hook_active: true }, { cwd: dir }).status, 0);
	assert.equal(run("verify-before-done", { cwd: dir }, { cwd: dir, env: { HARNESS_VERIFY_BEFORE_DONE: "off" } }).status, 0);
});

test("knowledge-root scaffolds a root Railly's resolver accepts and exports it", () => {
	const dir = repo({ agents: true });
	const envFile = join(dir, "..", `${Date.now()}-env`);
	writeFileSync(envFile, "");
	const r = run("knowledge-root", { cwd: dir }, { cwd: dir, env: { CLAUDE_ENV_FILE: envFile } });
	assert.equal(r.status, 0, r.stderr);
	const root = join(dir, ".agents", "knowledge");
	assert.equal(readFileSync(envFile, "utf8"), `export RAILLY_SKILLS_REPO='${root}'\n`);
	const resolved = spawnSync("node", [join(RAILLY, "scripts", "resolve-source-root.mjs")], {
		encoding: "utf8",
		env: { ...process.env, RAILLY_SKILLS_REPO: root },
	});
	assert.equal(resolved.status, 0, resolved.stderr);
	assert.equal(resolved.stdout.trim(), root);

	writeFileSync(join(root, "foundry", "maturity.json"), "kept\n");
	run("knowledge-root", { cwd: dir }, { cwd: dir, env: { CLAUDE_ENV_FILE: envFile } });
	assert.equal(readFileSync(join(root, "foundry", "maturity.json"), "utf8"), "kept\n");
});

test("knowledge-root leaves a repository without .agents alone", () => {
	const dir = repo();
	const r = run("knowledge-root", { cwd: dir }, { cwd: dir, env: { CLAUDE_ENV_FILE: "" } });
	assert.equal(r.status, 0);
	assert.equal(existsSync(join(dir, ".agents")), false);
});

// route-guard
//    15. lets an edit through on a routed path whose owner this agent never loaded
//    16. blocks an edit on an unrouted path, or in a repository without a routes block
//    17. counts a skill the orchestrator loaded for a subagent that did not load it
//    18. misses a plugin-prefixed load (`plugin:skill`) or a read of the owner's SKILL.md
const ROUTING = "# Routing\n\n```routes\nsrc/* :: acme-cli\ndb/* :: acme-db, acme-sql\n```\n";
const transcriptWith = (dir, name, skills, reads = []) => {
	const file = join(dir, "..", `${name}-${Date.now()}.jsonl`);
	const lines = [
		...skills.map((s) => ({ type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: s } }] } })),
		...reads.map((f) => ({ type: "assistant", message: { content: [{ type: "tool_use", name: "Read", input: { file_path: f } }] } })),
	];
	writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n"));
	return file;
};
const edit = (dir, path, transcript, extra = {}) =>
	run("route-guard", { cwd: dir, tool_name: "Write", tool_input: { file_path: join(dir, path) }, transcript_path: transcript, ...extra }, { cwd: dir });

test("route-guard blocks an edit on a routed path until its owners are loaded", () => {
	const dir = repo({ agents: true });
	writeFileSync(join(dir, ".agents", "routing.md"), ROUTING);
	const none = transcriptWith(dir, "none", []);
	const blocked = edit(dir, "src/cli.js", none);
	assert.equal(blocked.status, 2);
	assert.match(blocked.stderr, /Skill\(acme-cli\)/);
	assert.equal(edit(dir, "src/cli.js", transcriptWith(dir, "one", ["acme-cli"])).status, 0);
	assert.equal(edit(dir, "src/cli.js", transcriptWith(dir, "pfx", ["harness:acme-cli"])).status, 0);
	assert.equal(edit(dir, "src/cli.js", transcriptWith(dir, "read", [], [join(dir, ".claude/skills/acme-cli/SKILL.md")])).status, 0);
	const partial = edit(dir, "db/001.sql", transcriptWith(dir, "half", ["acme-db"]));
	assert.equal(partial.status, 2);
	assert.match(partial.stderr, /acme-sql/);
	assert.doesNotMatch(partial.stderr, /Skill\(acme-db\)/);
});

test("route-guard leaves unrouted paths, other repositories and its off switch alone", () => {
	const dir = repo({ agents: true });
	writeFileSync(join(dir, ".agents", "routing.md"), ROUTING);
	const none = transcriptWith(dir, "none", []);
	assert.equal(edit(dir, "README.md", none).status, 0);
	assert.equal(edit(dir, "src/cli.js", none, {}).status, 2);
	assert.equal(run("route-guard", { cwd: dir, tool_name: "Write", tool_input: { file_path: join(dir, "src/cli.js") }, transcript_path: none }, { cwd: dir, env: { HARNESS_ROUTE_GUARD: "off" } }).status, 0);
	const plain = repo();
	assert.equal(edit(plain, "src/cli.js", none).status, 0);
});

test("route-guard reads a subagent's own transcript, not the orchestrator's", () => {
	const dir = repo({ agents: true });
	writeFileSync(join(dir, ".agents", "routing.md"), ROUTING);
	const session = transcriptWith(dir, "session", ["acme-cli"]);
	const subagents = join(session.replace(/\.jsonl$/, ""), "subagents");
	mkdirSync(subagents, { recursive: true });
	writeFileSync(join(subagents, "agent-a1.jsonl"), "");
	assert.equal(edit(dir, "src/cli.js", session, { agent_id: "a1" }).status, 2);
	writeFileSync(join(subagents, "agent-a1.jsonl"), readFileSync(session, "utf8"));
	assert.equal(edit(dir, "src/cli.js", session, { agent_id: "a1" }).status, 0);
});

// route-guard, from Workflow subagents (the revisor's fix agents in nomenclator)
//    23. lets through an edit in a worktree other than the hook's cwd (the cwd's repo is checked)
//    24. misses a Workflow subagent's transcript under subagents/workflows/<run>/
//    25. lets a Bash write of a routed file through (sed -i, a redirection, an inline interpreter,
//        a script whose text names the file)
//    26. blocks a Bash read of a routed file (cat, grep, sed -n) or a tool run over it (pytest)
const bash = (cwd, command, transcript, extra = {}) =>
	run("route-guard", { cwd, tool_name: "Bash", tool_input: { command }, transcript_path: transcript, ...extra }, { cwd });

test("route-guard checks the repository of the edited file, not the hook's cwd", () => {
	const session = repo();
	const worktree = repo({ agents: true });
	writeFileSync(join(worktree, ".agents", "routing.md"), ROUTING);
	const none = transcriptWith(worktree, "none", []);
	const blocked = run("route-guard", { cwd: session, tool_name: "Edit", tool_input: { file_path: join(worktree, "src/cli.js") }, transcript_path: none }, { cwd: session });
	assert.equal(blocked.status, 2);
	assert.match(blocked.stderr, /Skill\(acme-cli\)/);
	const fresh = run("route-guard", { cwd: session, tool_name: "Write", tool_input: { file_path: join(worktree, "src/new/dir/x.js") }, transcript_path: none }, { cwd: session });
	assert.equal(fresh.status, 2);
});

test("route-guard reads a Workflow subagent's transcript under subagents/workflows/<run>/", () => {
	const dir = repo({ agents: true });
	writeFileSync(join(dir, ".agents", "routing.md"), ROUTING);
	const session = transcriptWith(dir, "session", ["acme-cli"]);
	const run1 = join(session.replace(/\.jsonl$/, ""), "subagents", "workflows", "wf_1");
	mkdirSync(run1, { recursive: true });
	writeFileSync(join(run1, "agent-w1.jsonl"), "");
	assert.equal(edit(dir, "src/cli.js", session, { agent_id: "w1" }).status, 2);
	writeFileSync(join(run1, "agent-w1.jsonl"), readFileSync(session, "utf8"));
	assert.equal(edit(dir, "src/cli.js", session, { agent_id: "w1" }).status, 0);
});

test("route-guard treats a Bash command that writes a routed file as an edit, and lets reads pass", () => {
	const dir = repo({ agents: true });
	writeFileSync(join(dir, ".agents", "routing.md"), ROUTING);
	mkdirSync(join(dir, "src"), { recursive: true });
	writeFileSync(join(dir, "src", "cli.js"), "x\n");
	const none = transcriptWith(dir, "none", []);
	for (const cmd of [
		"sed -i 's/a/b/' src/cli.js",
		"echo x > src/cli.js",
		"printf x | tee -a src/cli.js",
		"python3 - <<'EOF'\nopen('src/cli.js','w').write('y')\nEOF",
		`node -e "require('fs').writeFileSync('${join(dir, "src/cli.js")}', '')"`,
	]) {
		const r = bash(dir, cmd, none);
		assert.equal(r.status, 2, cmd);
		assert.match(r.stderr, /Skill\(acme-cli\)/, cmd);
	}
	writeFileSync(join(dir, "..", "fix-script.py"), "p = 'src/cli.js'\nopen(p, 'w').write('z')\n");
	assert.equal(bash(dir, `python3 ${join(dir, "..", "fix-script.py")}`, none).status, 2);
	for (const cmd of ["cat src/cli.js", "grep -n x src/cli.js", "sed -n 1,5p src/cli.js", "git diff -- src/cli.js", "uv run pytest src/cli.js", "node scripts/x.mjs src/cli.js 2>/dev/null"])
		assert.equal(bash(dir, cmd, none).status, 0, cmd);
	assert.equal(bash(dir, "sed -i 's/a/b/' src/cli.js", transcriptWith(dir, "one", ["acme-cli"])).status, 0);
	assert.equal(bash(dir, "echo x > README.md", none).status, 0);
});

// loop-entry
//    19. stays silent in a repository without .agents/harness.md (every other repository)
//    20. says nothing in a harnessed one, so a plainly worded change skips the loop
test("loop-entry speaks only in a harnessed repository, and honors its off switch", () => {
	const plain = repo({ agents: true });
	assert.equal(run("loop-entry", { cwd: plain }, { cwd: plain }).stdout, "");
	writeFileSync(join(plain, ".agents", "harness.md"), "# Harness\n");
	const out = JSON.parse(run("loop-entry", { cwd: plain }, { cwd: plain }).stdout);
	assert.equal(out.hookSpecificOutput.hookEventName, "UserPromptSubmit");
	assert.match(out.hookSpecificOutput.additionalContext, /Skill\(experimental:loop\)/);
	assert.equal(run("loop-entry", { cwd: plain }, { cwd: plain, env: { HARNESS_LOOP_ENTRY: "off" } }).stdout, "");
});

// verify-before-done without a contract
//    21. lets a harnessed session that edited files stop without a contract (the loop skipped)
//    22. blocks a session that only read, or one whose dirty tree is someone else's work
test("verify-before-done blocks a harnessed session that edited without a contract, and only that", () => {
	const dir = repo({ kit: true });
	writeFileSync(join(dir, ".agents", "harness.md"), "# Harness\n");
	const edited = join(dir, "..", `edited-${Date.now()}.jsonl`);
	writeFileSync(edited, JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Edit", input: { file_path: join(dir, "app.txt") } }] } }));
	const read = join(dir, "..", `read-${Date.now()}.jsonl`);
	writeFileSync(read, JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Read", input: { file_path: join(dir, "app.txt") } }] } }));
	writeFileSync(join(dir, "app.txt"), "someone else's work in progress\n");
	const blocked = run("verify-before-done", { cwd: dir, transcript_path: edited }, { cwd: dir });
	assert.equal(blocked.status, 2);
	assert.match(blocked.stderr, /no contract/);
	assert.equal(run("verify-before-done", { cwd: dir, transcript_path: read }, { cwd: dir }).status, 0);
	assert.equal(run("verify-before-done", { cwd: dir, transcript_path: edited, stop_hook_active: true }, { cwd: dir }).status, 0);
	const notHarnessed = repo({ kit: true });
	assert.equal(run("verify-before-done", { cwd: notHarnessed, transcript_path: edited }, { cwd: notHarnessed }).status, 0);
});
