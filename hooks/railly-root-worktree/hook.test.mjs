import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ensureRoot } from "./hook.mjs";

const FAKE_ROOT = "C:\\ruta\\canonica\\knowledge";

function git(cwd, ...args) {
	const r = spawnSync("git", args, { cwd, encoding: "utf8" });
	assert.equal(r.status, 0, `git ${args.join(" ")} failed: ${r.stderr}`);
}

// A repository with one commit and a worktree, the shape the hook meets at
// session start. `claude` decides whether the main worktree names a root.
function repoWithWorktree(t, { claude = true } = {}) {
	const base = mkdtempSync(join(tmpdir(), "railly-root-"));
	t.after(() => rmSync(base, { recursive: true, force: true }));
	const main = join(base, "main");
	mkdirSync(main, { recursive: true });
	git(main, "init", "-q", ".");
	git(main, "config", "user.email", "t@t");
	git(main, "config", "user.name", "t");
	writeFileSync(join(main, "a.txt"), "x\n");
	git(main, "add", "-A");
	git(main, "commit", "-qm", "init");
	if (claude) {
		mkdirSync(join(main, ".claude"));
		writeFileSync(
			join(main, ".claude", "settings.local.json"),
			`${JSON.stringify({ env: { RAILLY_SKILLS_REPO: FAKE_ROOT } }, null, 2)}\n`,
		);
	}
	const worktree = join(base, "wt");
	git(main, "worktree", "add", "-q", worktree, "-b", "rama");
	return { main, worktree };
}

const readVar = (dir) =>
	JSON.parse(readFileSync(join(dir, ".claude", "settings.local.json"), "utf8")).env.RAILLY_SKILLS_REPO;

test("a worktree without .claude/ inherits the main worktree's root", (t) => {
	const { worktree } = repoWithWorktree(t);
	assert.equal(existsSync(join(worktree, ".claude")), false);
	assert.equal(ensureRoot(worktree), FAKE_ROOT);
	assert.equal(readVar(worktree), FAKE_ROOT);
});

test("an existing .claude/ and its other settings survive the write", (t) => {
	const { worktree } = repoWithWorktree(t);
	mkdirSync(join(worktree, ".claude"));
	writeFileSync(join(worktree, ".claude", "settings.local.json"), `${JSON.stringify({ model: "opus" })}\n`);
	assert.equal(ensureRoot(worktree), FAKE_ROOT);
	const settings = JSON.parse(readFileSync(join(worktree, ".claude", "settings.local.json"), "utf8"));
	assert.equal(settings.env.RAILLY_SKILLS_REPO, FAKE_ROOT);
	assert.equal(settings.model, "opus", "unrelated settings must not be dropped");
});

test("a worktree that already names a root is left alone", (t) => {
	const { worktree } = repoWithWorktree(t);
	mkdirSync(join(worktree, ".claude"));
	const mine = `${JSON.stringify({ env: { RAILLY_SKILLS_REPO: "C:\\propio" } }, null, 2)}\n`;
	writeFileSync(join(worktree, ".claude", "settings.local.json"), mine);
	assert.equal(ensureRoot(worktree), null);
	assert.equal(readFileSync(join(worktree, ".claude", "settings.local.json"), "utf8"), mine);
});

test("outside a repository nothing is written", (t) => {
	const base = mkdtempSync(join(tmpdir(), "railly-root-"));
	t.after(() => rmSync(base, { recursive: true, force: true }));
	assert.equal(ensureRoot(base), null);
	assert.equal(existsSync(join(base, ".claude")), false);
});
