#!/usr/bin/env node
// PostToolUse hook, matcher Edit|Write|MultiEdit: warns (exit 2, the reason on stderr reaches the
// model) when an edit adds a comment line that matches one of the repository's comment patterns: a
// docs ID, an epic code, a migration number, a date, a history marker. It never undoes the edit.
//
// The patterns come from the `comment-guard` block of the "Code" section of the repository's
// .agents/harness.md, one regular expression per line, a label after ` :: `. A repository without
// that block gets nothing from this hook.
//
// Only added lines count: for Edit and MultiEdit, the lines of new_string that old_string does not
// have; for Write, the lines the file at HEAD does not have (all of them for a new file).

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function patternsOf(harnessMd) {
	const section = /^## Code\s*$([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(harnessMd ?? "")?.[1] ?? "";
	const block = /^```comment-guard\s*$([\s\S]*?)^```\s*$/m.exec(section)?.[1] ?? "";
	return block
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l && !l.startsWith("#"))
		.map((l) => {
			const [source, label] = l.split(" :: ");
			return { re: new RegExp(source.trim(), "i"), label: (label ?? source).trim() };
		});
}

// The comment text of a line, or null. Line comments (`//`, `#`, `--`) and the lines of a block
// comment (`/*`, ` *`). A marker inside a string is not a comment.
export function commentOf(line, file) {
	const t = line.trim();
	const hash = /\.(sh|bash|py|ya?ml|toml|rb)$|(^|\/)Dockerfile/.test(file);
	const sql = /\.sql$/.test(file);
	if (/^(\/\/|\/\*|\*(?!\*\/)|\{\/\*)/.test(t)) return t;
	if (hash && t.startsWith("#")) return t;
	if (sql && t.startsWith("--")) return t;
	const marker = sql ? "--" : hash ? "#" : "//";
	let quote = null;
	for (let i = 0; i < line.length; i++) {
		const c = line[i];
		if (quote) {
			if (c === "\\") i++;
			else if (c === quote) quote = null;
		} else if (c === '"' || c === "'" || c === "`") quote = c;
		else if (line.startsWith(marker, i) && (marker !== "//" || line[i - 1] !== ":")) return line.slice(i);
	}
	return null;
}

const lines = (s) => (typeof s === "string" ? s.split("\n") : []);

// Lines of `after` that `before` does not have, counting repeats.
export function added(before, after) {
	const pool = new Map();
	for (const l of lines(before)) pool.set(l, (pool.get(l) ?? 0) + 1);
	const out = [];
	for (const l of lines(after)) {
		const n = pool.get(l) ?? 0;
		if (n > 0) pool.set(l, n - 1);
		else out.push(l);
	}
	return out;
}

function gitRoot(file) {
	let dir = dirname(file);
	while (dir !== "/" && !existsSync(dir)) dir = dirname(dir);
	const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: dir, encoding: "utf8" });
	return r.status === 0 ? r.stdout.trim() : null;
}

export function findings(input, read = (f) => (existsSync(f) ? readFileSync(f, "utf8") : "")) {
	const ti = input?.tool_input ?? {};
	const file = typeof ti.file_path === "string" ? resolve(input.cwd || process.cwd(), ti.file_path) : null;
	if (!file) return [];
	const root = gitRoot(file);
	if (!root) return [];
	const patterns = patternsOf(read(join(root, ".agents", "harness.md")));
	if (!patterns.length) return [];
	let fresh = [];
	if (input.tool_name === "Edit") fresh = added(ti.old_string, ti.new_string);
	else if (input.tool_name === "MultiEdit") fresh = (ti.edits ?? []).flatMap((e) => added(e.old_string, e.new_string));
	else if (input.tool_name === "Write") {
		const head = spawnSync("git", ["show", `HEAD:${relative(root, file)}`], { cwd: root, encoding: "utf8" });
		fresh = added(head.status === 0 ? head.stdout : "", ti.content ?? read(file));
	}
	const out = [];
	for (const line of fresh) {
		const comment = commentOf(line, file);
		if (!comment) continue;
		const hit = patterns.find((p) => p.re.test(comment));
		if (hit) out.push({ line: line.trim(), label: hit.label });
	}
	return out.map((f) => ({ ...f, file: relative(root, file) }));
}

function main() {
	let input;
	try {
		input = JSON.parse(readFileSync(0, "utf8"));
	} catch {
		return;
	}
	const hits = findings(input);
	if (!hits.length) return;
	process.stderr.write(
		[
			`comment-guard: ${hits[0].file} gained ${hits.length} comment line(s) the repository does not keep (.agents/harness.md, "Code"):`,
			...hits.slice(0, 10).map((h) => `  ${h.label}: ${h.line}`),
			"A comment says only what changes from outside the code: no IDs, epic codes, migration numbers, dates or history. Rewrite or drop it; the edit stays as it is.",
		].join("\n") + "\n",
	);
	process.exit(2);
}

// realpath: a plugin cache reached through a symlink (an Orca profile) gives argv[1] the link path.
const self = fileURLToPath(import.meta.url);
if (process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(self)) main();
